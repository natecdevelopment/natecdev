/**
 * Reads the "Natec agreement schedules" Excel (one row per payment, per flat) and turns it into
 * schedule rows for admin_save_client. Booking money and down payment have no due date of their own:
 * they are stored with a date on/before the first instalment so they stay first and are paid first.
 */
import type { Cell, Workbook } from "@/lib/xlsx-lite";
import { toIsoDate } from "@/lib/sheet-import";
import type { ScheduleRow } from "@/lib/money";

export type AgreementItem = "Booking money" | "Down payment" | "Instalment" | "Car parking";
export type AgreementRow = { item: AgreementItem; no: number | null; amount: number; payFrom: string | null; due: string | null };
export type AgreementPlan = { flat: string; project: string; agreementDate: string | null; rows: AgreementRow[]; total: number; problems: string[] };

const txt = (c: Cell | undefined) => (c == null ? "" : String(c).trim());
const flatKey = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, "");
const money = (c: Cell | undefined) => {
  if (typeof c === "number") return Math.round(c);
  const d = txt(c).replace(/[^\d.]/g, "");
  return d ? Math.round(Number(d)) : NaN;
};
const isoDate = (c: Cell | undefined): string | null => {
  if (c == null || txt(c) === "") return null;
  if (typeof c === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.trim())) return c.trim();
  return toIsoDate(c);
};

function itemOf(s: string): AgreementItem | null {
  if (/booking/i.test(s)) return "Booking money";
  if (/down/i.test(s)) return "Down payment";
  if (/parking/i.test(s)) return "Car parking";
  if (/instal|kisti|installment/i.test(s)) return "Instalment";
  return null;
}

/** Locate a header row containing all of `need` (case-insensitive) and return column indexes by name. */
function header(rows: Cell[][], need: string[], optional: string[] = []) {
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const cells = (rows[r] ?? []).map((c) => txt(c).toLowerCase());
    const find = (n: string) => cells.findIndex((c) => c.startsWith(n));
    if (need.every((n) => find(n) >= 0)) {
      const cols: Record<string, number> = {};
      [...need, ...optional].forEach((n) => { cols[n] = find(n); });
      return { row: r, cols };
    }
  }
  return null;
}

export function parseScheduleWorkbook(wb: Workbook): { plans: AgreementPlan[]; errors: string[] } {
  const errors: string[] = [];
  const name = wb.sheetNames.find((n) => /schedule/i.test(n)) ?? wb.sheetNames[0];
  const rows = (name && wb.sheets[name]) || [];
  const h = header(rows, ["flat", "item", "amount"], ["project", "no", "pay from", "due"]);
  if (!h) return { plans: [], errors: ["Could not find the header row (Flat · Item · Amount · Due date) in the Schedule sheet."] };

  // Optional Summary sheet: agreement date per flat.
  const agreement = new Map<string, string | null>();
  const sumName = wb.sheetNames.find((n) => /summary/i.test(n));
  if (sumName) {
    const srows = wb.sheets[sumName] ?? [];
    const sh = header(srows, ["flat"], ["agreement date"]);
    if (sh && sh.cols["agreement date"]! >= 0) {
      for (const row of srows.slice(sh.row + 1)) {
        const f = flatKey(txt(row[sh.cols["flat"]!]));
        if (f) agreement.set(f, isoDate(row[sh.cols["agreement date"]!]));
      }
    }
  }

  const byFlat = new Map<string, AgreementPlan>();
  const col = (row: Cell[], k: string) => (h.cols[k]! >= 0 ? row[h.cols[k]!] : undefined);
  rows.slice(h.row + 1).forEach((row, i) => {
    const flatRaw = txt(col(row, "flat"));
    const itemRaw = txt(col(row, "item"));
    if (!flatRaw && !itemRaw) return;
    const line = h.row + i + 2;
    const flat = flatKey(flatRaw);
    if (!flat) { errors.push(`Row ${line}: no flat number.`); return; }
    const plan = byFlat.get(flat) ?? { flat, project: txt(col(row, "project")), agreementDate: agreement.get(flat) ?? null, rows: [], total: 0, problems: [] };
    byFlat.set(flat, plan);
    const item = itemOf(itemRaw);
    if (!item) { plan.problems.push(`Row ${line}: unknown item "${itemRaw}".`); return; }
    const amount = money(col(row, "amount"));
    if (!(amount >= 0)) { plan.problems.push(`Row ${line}: amount is missing.`); return; }
    const noCell = txt(col(row, "no")) || (/(\d+)/.exec(itemRaw)?.[1] ?? "");
    const no = item === "Instalment" ? Number(noCell) || null : null;
    plan.rows.push({ item, no, amount, payFrom: isoDate(col(row, "pay from")), due: isoDate(col(row, "due")) });
  });

  for (const p of byFlat.values()) {
    p.total = p.rows.reduce((s, r) => s + r.amount, 0);
    const inst = p.rows.filter((r) => r.item === "Instalment");
    if (!inst.length) p.problems.push("No instalments listed.");
    inst.forEach((r, k) => {
      if (r.no !== k + 1) p.problems.push(`Instalments must be numbered 1, 2, 3… in order (found ${r.no ?? "blank"} at position ${k + 1}).`);
      if (!r.due) p.problems.push(`Instalment ${r.no ?? k + 1} has no due date.`);
    });
    for (const r of p.rows) if (r.item === "Car parking" && !r.due) p.problems.push("Car parking has no due date.");
    if (p.rows.filter((r) => r.item === "Booking money").length > 1) p.problems.push("Booking money is listed twice.");
    if (p.rows.filter((r) => r.item === "Down payment").length > 1) p.problems.push("Down payment is listed twice.");
    p.problems = [...new Set(p.problems)];
  }
  return { plans: [...byFlat.values()].sort((a, b) => a.flat.localeCompare(b.flat, "en", { numeric: true })), errors };
}

export type ExistingRow = { id: string; label: string; due_date: string; amount: number; paid: number };

/**
 * New schedule rows for one client. Existing row ids are reused (booking/down by label, instalments in
 * date order) when the new amount still covers what was paid, so paid history stays attached.
 */
export function buildAgreementRows(plan: AgreementPlan, existing: ExistingRow[], bookingDate: string | null): ScheduleRow[] {
  const inst = plan.rows.filter((r) => r.item === "Instalment");
  const others = plan.rows.filter((r) => r.item === "Car parking");
  const firstDue = [...inst, ...others].map((r) => r.due!).sort()[0]!;
  const start = [bookingDate, plan.agreementDate, firstDue].filter((d): d is string => !!d).sort()[0]!;
  const upFront = start <= firstDue ? start : firstDue;

  const pool = [...existing];
  const take = (pred: (r: ExistingRow) => boolean, amount: number) => {
    const k = pool.findIndex((r) => pred(r) && r.paid <= amount);
    return k >= 0 ? pool.splice(k, 1)[0]!.id : undefined;
  };
  const out: ScheduleRow[] = [];
  const row = (id: string | undefined, label: string, due_date: string, amount: number): ScheduleRow => (id ? { id, label, due_date, amount } : { label, due_date, amount });
  for (const item of ["Booking money", "Down payment"] as const) {
    const r = plan.rows.find((x) => x.item === item);
    if (r) out.push(row(take((x) => x.label === item, r.amount), item, upFront, r.amount));
  }
  const oldInst = pool.filter((x) => x.label !== "Booking money" && x.label !== "Down payment").sort((a, b) => a.due_date.localeCompare(b.due_date));
  inst.forEach((r, k) => {
    const cand = oldInst[k];
    const id = cand && cand.paid <= r.amount && pool.includes(cand) ? (pool.splice(pool.indexOf(cand), 1), cand.id) : undefined;
    out.push(row(id, `Instalment ${k + 1} of ${inst.length}`, r.due!, r.amount));
  });
  for (const r of others) out.push(row(take((x) => x.label === "Car parking", r.amount), "Car parking", r.due!, r.amount));
  return out;
}
