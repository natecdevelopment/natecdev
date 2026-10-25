/**
 * The "Natec clients" Excel: one workbook for adding and updating client accounts.
 *   Clients  — one row per flat (name, phone, dates, total price…). Blank cell = keep what the website has.
 *   Schedule — one row per payment due (Booking money / Down payment need no date; Instalment 1, 2, 3… need a due date).
 *   Payments — one row per payment received.
 * For every flat in the file, the website's schedule and payments are replaced by what the file says.
 */
import type { Cell, Workbook } from "@/lib/xlsx-lite";
import { cleanPhone, toIsoDate } from "@/lib/sheet-import";
import { parseScheduleWorkbook, type AgreementPlan } from "@/lib/schedule-import";
import { PAYMENT_METHODS, PAYMENT_TYPES } from "@/lib/account";

export type ClientInfo = Partial<{
  full_name: string; phone: string; email: string; address: string; floor: string; size_sft: number;
  parking: boolean; booking_date: string; agreement_date: string; total_price: number; notes: string;
}>;
export type PaymentEntry = { paid_on: string; amount: number; type: string; method: string; reference: string; note: string };
export type ClientEntry = { flat: string; project: string; info: ClientInfo; schedule: AgreementPlan | null; payments: PaymentEntry[]; problems: string[] };

const txt = (c: Cell | undefined) => (c == null ? "" : String(c).trim());
export const flatKey = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, "");
const num = (c: Cell | undefined) => {
  if (typeof c === "number") return c;
  const d = txt(c).replace(/[^\d.]/g, "");
  return d ? Number(d) : NaN;
};
const date = (c: Cell | undefined) => {
  if (c == null || txt(c) === "") return null;
  if (typeof c === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.trim())) return c.trim();
  return toIsoDate(c);
};

function header(rows: Cell[][], need: string[], optional: string[]) {
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
const sheet = (wb: Workbook, re: RegExp) => { const n = wb.sheetNames.find((s) => re.test(s)); return n ? wb.sheets[n] ?? [] : null; };
const pick = <T extends readonly string[]>(list: T, v: string) => list.find((x) => x.toLowerCase() === v.toLowerCase());

export function parseClientWorkbook(wb: Workbook): { clients: ClientEntry[]; errors: string[] } {
  const errors: string[] = [];
  const out = new Map<string, ClientEntry>();
  const entry = (flat: string, project = "") => {
    let e = out.get(flat);
    if (!e) { e = { flat, project, info: {}, schedule: null, payments: [], problems: [] }; out.set(flat, e); }
    if (project && !e.project) e.project = project;
    return e;
  };

  // ---- Clients
  const crows = sheet(wb, /^clients?$/i);
  if (!crows) errors.push('No "Clients" sheet found.');
  else {
    const h = header(crows, ["flat"], ["project", "client name", "phone", "email", "address", "floor", "size", "car parking", "booking date", "agreement date", "total price", "notes"]);
    if (!h) errors.push('Clients sheet: header row with "Flat" not found.');
    else crows.slice(h.row + 1).forEach((row, i) => {
      const get = (k: string) => (h.cols[k]! >= 0 ? row[h.cols[k]!] : undefined);
      const flat = flatKey(txt(get("flat")));
      if (!flat) return;
      const e = entry(flat, txt(get("project")));
      const line = h.row + i + 2;
      const s = (k: string) => txt(get(k));
      if (s("client name")) e.info.full_name = s("client name");
      if (s("phone")) { const p = cleanPhone(get("phone") ?? null); if (p) e.info.phone = p; else e.problems.push(`Clients row ${line}: phone "${s("phone")}" is not a valid Bangladesh mobile number.`); }
      if (s("email")) e.info.email = s("email").toLowerCase();
      if (s("address")) e.info.address = s("address");
      if (s("floor")) e.info.floor = s("floor");
      if (s("size")) { const n = num(get("size")); if (n > 0) e.info.size_sft = Math.round(n); }
      if (s("car parking")) e.info.parking = /^(y|yes|1|true)/i.test(s("car parking"));
      for (const k of ["booking date", "agreement date"] as const) {
        if (!s(k)) continue;
        const d = date(get(k));
        if (d) e.info[k === "booking date" ? "booking_date" : "agreement_date"] = d;
        else e.problems.push(`Clients row ${line}: "${s(k)}" is not a date.`);
      }
      if (s("total price")) { const n = num(get("total price")); if (n >= 0) e.info.total_price = Math.round(n); }
      if (s("notes")) e.info.notes = s("notes");
    });
  }

  // ---- Schedule (reuses the agreement schedule reader)
  if (sheet(wb, /schedule/i)) {
    const sched = parseScheduleWorkbook({ sheetNames: wb.sheetNames.filter((n) => /schedule/i.test(n)), sheets: wb.sheets });
    errors.push(...sched.errors.map((e) => `Schedule: ${e}`));
    for (const p of sched.plans) { const e = entry(p.flat, p.project); e.schedule = p; e.problems.push(...p.problems); }
  }

  // ---- Payments
  const prows = sheet(wb, /payment/i);
  if (prows) {
    const h = header(prows, ["flat", "paid on", "amount"], ["type", "method", "reference", "note"]);
    if (!h) { if (prows.some((r) => r.some((c) => txt(c)))) errors.push('Payments sheet: header row (Flat · Paid on · Amount) not found.'); }
    else prows.slice(h.row + 1).forEach((row, i) => {
      const get = (k: string) => (h.cols[k]! >= 0 ? row[h.cols[k]!] : undefined);
      const flat = flatKey(txt(get("flat")));
      if (!flat && !txt(get("amount"))) return;
      const line = h.row + i + 2;
      if (!flat) { errors.push(`Payments row ${line}: no flat number.`); return; }
      const e = entry(flat);
      const paid_on = date(get("paid on"));
      const amount = Math.round(num(get("amount")));
      if (!paid_on) { e.problems.push(`Payments row ${line}: "Paid on" date is missing.`); return; }
      if (!(amount > 0)) { e.problems.push(`Payments row ${line}: amount is missing.`); return; }
      const type = pick(PAYMENT_TYPES, txt(get("type"))) ?? (txt(get("type")) ? "Other" : "Instalment");
      const method = pick(PAYMENT_METHODS, txt(get("method"))) ?? (txt(get("method")) ? "Other" : "Cash");
      e.payments.push({ paid_on, amount, type, method, reference: txt(get("reference")), note: txt(get("note")) });
    });
  }

  // A row with only a flat number (waiting to be filled in) is not imported.
  for (const [k, e] of out) if (!Object.keys(e.info).length && !e.schedule && !e.payments.length && !e.problems.length) out.delete(k);
  for (const e of out.values()) {
    const sched = e.schedule?.total ?? 0;
    if (e.info.total_price == null && e.schedule) e.info.total_price = sched;
    if (e.schedule && e.info.total_price != null && Math.abs(e.info.total_price - sched) > 0.5)
      e.problems.push(`Total price ${e.info.total_price.toLocaleString("en-IN")} does not match the schedule total ${sched.toLocaleString("en-IN")}.`);
    e.problems = [...new Set(e.problems)];
  }
  return { clients: [...out.values()].sort((a, b) => a.flat.localeCompare(b.flat, "en", { numeric: true })), errors };
}
