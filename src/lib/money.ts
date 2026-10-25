/** "৳ 12,50,000" — Bangladeshi lakh/crore grouping. */
export function taka(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  const neg = v < 0;
  const s = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Math.abs(v));
  return `${neg ? "−" : ""}৳ ${s}`;
}

export type PlanInput = {
  total: number; booking: number; down: number; count: number;
  frequency: "monthly" | "quarterly" | "custom"; firstDue: string; bookingDate?: string;
};
/** id/paid are set only for rows already saved (client editor); paid > 0 means the row is locked. */
export type ScheduleRow = { due_date: string; amount: number; label: string; id?: string; paid?: number };

function addMonths(iso: string, m: number) {
  const [y, mo, d] = iso.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, mo - 1 + m, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(d, last));
  return dt.toISOString().slice(0, 10);
}

/** Booking money + down payment + N equal instalments; the last instalment absorbs rounding so the plan adds up to the total. */
export function generateSchedule(p: PlanInput): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  const start = p.bookingDate || p.firstDue;
  if (p.booking > 0) rows.push({ due_date: start, amount: p.booking, label: "Booking money" });
  if (p.down > 0) rows.push({ due_date: start, amount: p.down, label: "Down payment" });
  const rest = Math.max(0, p.total - p.booking - p.down);
  const n = Math.max(0, Math.floor(p.count));
  if (n > 0 && rest > 0) {
    const each = Math.floor(rest / n);
    const step = p.frequency === "quarterly" ? 3 : 1;
    for (let i = 0; i < n; i++) {
      rows.push({ due_date: addMonths(p.firstDue, i * step), amount: i === n - 1 ? rest - each * (n - 1) : each, label: `Instalment ${i + 1} of ${n}` });
    }
  }
  return rows;
}

export type OpenInstalment = { id: string; due_date: string; amount: number; paid_amount: number };
/** Spreads a payment over the oldest unpaid instalments first. */
export function allocatePayment(instalments: OpenInstalment[], amount: number) {
  let left = amount;
  const out: { id: string; apply: number }[] = [];
  for (const i of [...instalments].sort((a, b) => a.due_date.localeCompare(b.due_date))) {
    const open = Math.max(0, Number(i.amount) - Number(i.paid_amount));
    if (open <= 0 || left <= 0) continue;
    const apply = Math.min(open, left);
    out.push({ id: i.id, apply });
    left -= apply;
  }
  return { allocations: out, unapplied: left };
}

/** 0–4 password strength score. */
export function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
  return s;
}

/* ---------- Payment plan builder (admin "Payment plan" step / "Edit schedule") ---------- */
export type PlanForm = {
  total: number; booking: number; count: number; freqMonths: 1 | 2 | 3 | 6 | 12; firstDue: string;
  instAmount: number | null; downManual: number | null; downDue: string; round: 0 | 100 | 500 | 1000;
};
export type PlanResult = { remainingAfterBooking: number; down: number; each: number; last: number; rows: ScheduleRow[]; errors: Partial<Record<keyof PlanForm | "plan", string>> };

export const addDays = (iso: string, d: number) => { const t = new Date(iso + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
export { addMonths as addMonthsClamped };

/** Works out down payment / instalment amount from the plan fields and builds the full schedule (booking + down + instalments). */
export function computePlan(p: PlanForm, bookingDate: string): PlanResult {
  const errors: PlanResult["errors"] = {};
  const n = Math.floor(p.count);
  const rem = p.total - p.booking;
  if (!(p.total > 0)) errors.total = "Enter the total price.";
  if (p.booking < 0) errors.booking = "Cannot be negative.";
  else if (p.booking > p.total) errors.booking = "Booking money cannot be more than the total price.";
  if (!(n >= 1 && n <= 120)) errors.count = "Enter between 1 and 120.";
  if (!p.firstDue) errors.firstDue = "Choose the first instalment date.";
  const roundDown = (v: number) => (p.round > 0 ? Math.floor(v / p.round) * p.round : Math.floor(v));
  let down = 0, each = 0, last = 0;
  const nn = Math.max(1, n || 1);
  if (p.downManual != null) {
    down = p.downManual;
    if (down < 0) errors.downManual = "Cannot be negative.";
    else if (down > p.total) errors.downManual = "Down payment cannot be more than the total price.";
    else if (down > rem) errors.downManual = "Down payment is more than what is left after booking.";
    const rest = Math.max(0, rem - down);
    each = roundDown(rest / nn); last = rest - each * (nn - 1);
  } else if (p.instAmount != null && p.instAmount > 0) {
    each = p.instAmount; last = each; down = rem - nn * each;
    if (down < 0) errors.instAmount = "Instalments add up to more than the price. Lower the instalment amount or the number of instalments.";
    else if (down > p.total) errors.instAmount = "Down payment cannot be more than the total price.";
  } else {
    const rest = Math.max(0, rem);
    each = roundDown(rest / nn); last = rest - each * (nn - 1);
  }
  const rows: ScheduleRow[] = [];
  if (p.booking > 0) rows.push({ due_date: bookingDate || p.firstDue, amount: p.booking, label: "Booking money" });
  if (down > 0) rows.push({ due_date: p.downDue || addDays(bookingDate || p.firstDue, 30), amount: down, label: "Down payment" });
  if (!errors.count && p.firstDue && !errors.instAmount) {
    for (let i = 0; i < n; i++) rows.push({ due_date: addMonths(p.firstDue, i * p.freqMonths), amount: i === n - 1 ? last : each, label: `Instalment ${i + 1} of ${n}` });
  }
  return { remainingAfterBooking: rem, down, each, last, rows, errors };
}

/** Booking money and down payment: paid up front, shown first and without a due date. */
export const isExtra = (l: string) => l === "Booking money" || l === "Down payment";
const EXTRA_ORDER: Record<string, number> = { "Booking money": 0, "Down payment": 1 };
/** Schedule display order: booking money, down payment, then everything else by due date. */
export function scheduleOrder<T extends { label: string; due_date: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const ea = EXTRA_ORDER[a.label] ?? 9, eb = EXTRA_ORDER[b.label] ?? 9;
    return ea !== eb ? ea - eb : a.due_date.localeCompare(b.due_date);
  });
}

/**
 * "Regenerate schedule" for an existing client: paid / partly-paid rows are kept as they are,
 * and the rest of the total is spread over fresh unpaid rows built from the plan fields.
 */
export function rebuildKeepingPaid(p: PlanForm, bookingDate: string, current: ScheduleRow[]): ScheduleRow[] {
  const locked = current.filter((r) => (r.paid ?? 0) > 0);
  const lockedLabels = new Set(locked.map((r) => r.label));
  const extras = computePlan(p, bookingDate).rows.filter((r) => isExtra(r.label) && !lockedLabels.has(r.label));
  const n = Math.max(0, Math.floor(p.count));
  const rest = p.total - locked.reduce((s, r) => s + r.amount, 0) - extras.reduce((s, r) => s + r.amount, 0);
  const out = [...locked, ...extras];
  if (n > 0 && rest > 0 && p.firstDue) {
    const each = p.round > 0 ? Math.floor(rest / n / p.round) * p.round : Math.floor(rest / n);
    for (let i = 0; i < n; i++) out.push({ due_date: addMonths(p.firstDue, i * p.freqMonths), amount: i === n - 1 ? rest - each * (n - 1) : each, label: `Instalment ${i + 1} of ${n}` });
  }
  return out.sort((a, b) => a.due_date.localeCompare(b.due_date));
}

/** Best guess of the plan fields from saved schedule rows (frequency from the gap between instalments). */
export function guessPlan(rows: ScheduleRow[], bookingDate: string, total: number): PlanForm {
  const sorted = [...rows].sort((a, b) => a.due_date.localeCompare(b.due_date));
  const inst = sorted.filter((r) => !isExtra(r.label));
  const down = sorted.find((r) => r.label === "Down payment");
  let freq: PlanForm["freqMonths"] = 1;
  if (inst.length > 1) {
    const [a, b] = [inst[0]!.due_date, inst[1]!.due_date].map((d) => d.split("-").map(Number) as [number, number, number]);
    const gap = (b![0] - a![0]) * 12 + (b![1] - a![1]);
    if ([1, 2, 3, 6, 12].includes(gap)) freq = gap as PlanForm["freqMonths"];
  }
  const amounts = inst.map((r) => r.amount);
  const round: PlanForm["round"] = amounts.every((x) => x % 1000 === 0) ? 1000 : amounts.every((x) => x % 500 === 0) ? 500 : amounts.every((x) => x % 100 === 0) ? 100 : 0;
  const today = new Date().toISOString().slice(0, 10);
  return {
    total, booking: Number(sorted.find((r) => r.label === "Booking money")?.amount ?? 0), count: inst.length || 24, freqMonths: freq,
    firstDue: inst[0]?.due_date ?? today, instAmount: null, downManual: null,
    downDue: down?.due_date ?? addDays(bookingDate || today, 30), round: inst.length ? round : 1000,
  };
}
