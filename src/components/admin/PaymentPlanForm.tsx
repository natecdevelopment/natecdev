import { useMemo, useState } from "react";
import { CheckCircle2, Lock, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { btnDanger, btnSm } from "@/components/admin/ui";
import { fmtDate } from "@/lib/account";
import { addDays, computePlan, isExtra, taka, type PlanForm, type ScheduleRow } from "@/lib/money";

export type PlanState = { plan: PlanForm; rows: ScheduleRow[]; dirty: boolean };

export function initialPlanState(bookingDate: string, total = 0): PlanState {
  const today = new Date().toISOString().slice(0, 10);
  const plan: PlanForm = { total, booking: 0, count: 24, freqMonths: 1, firstDue: today, instAmount: null, downManual: null, downDue: addDays(bookingDate || today, 30), round: 1000 };
  return { plan, rows: computePlan(plan, bookingDate).rows, dirty: false };
}

/** Returns the reason Next/Save must be blocked, or null. */
export function planBlocker(s: PlanState, bookingDate: string): string | null {
  const r = computePlan(s.plan, bookingDate);
  const first = Object.values(r.errors)[0];
  if (first) return first;
  if (s.rows.some((x) => !x.due_date || !(x.amount >= 0))) return "Every schedule row needs a date and an amount.";
  if (s.rows.some((x) => x.amount < (x.paid ?? 0))) return "A paid instalment cannot be reduced below the amount already paid.";
  const remaining = s.plan.total - s.rows.reduce((a, x) => a + Number(x.amount || 0), 0);
  if (Math.abs(remaining) > 0.5) return `Remaining to plan must be ৳ 0 (now ${taka(remaining)}).`;
  return null;
}

const digits = (v: string) => v.replace(/[^\d]/g, "");
const num = (v: string) => (digits(v) === "" ? 0 : Number(digits(v)));
const FREQ: [PlanForm["freqMonths"], string][] = [[1, "Monthly"], [2, "Every 2 months"], [3, "Quarterly"], [6, "Every 6 months"], [12, "Yearly"]];
const ROUND: [PlanForm["round"], string][] = [[0, "None"], [100, "৳100"], [500, "৳500"], [1000, "৳1,000"]];

/** `build` overrides how the schedule is generated (client editor: keep paid rows). Rows with paid > 0 are locked. */
export function PaymentPlanForm({ value, onChange, bookingDate, build }: { value: PlanState; onChange: (s: PlanState) => void; bookingDate: string; build?: (p: PlanForm) => ScheduleRow[] }) {
  const { plan, rows, dirty } = value;
  const gen = (p: PlanForm) => (build ? build(p) : computePlan(p, bookingDate).rows);
  const calc = useMemo(() => computePlan(plan, bookingDate), [plan, bookingDate]);
  const [pending, setPending] = useState<PlanForm | null>(null);
  const [kept, setKept] = useState(false);

  function setPlan(patch: Partial<PlanForm>) {
    const next = { ...plan, ...patch };
    if (dirty) { onChange({ ...value, plan: next }); if (!kept) setPending(next); return; }
    onChange({ plan: next, rows: gen(next), dirty: false });
  }
  const setRow = (i: number, patch: Partial<ScheduleRow>) => onChange({ ...value, rows: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)), dirty: true });

  const planTotal = rows.reduce((a, r) => a + Number(r.amount || 0), 0);
  const remaining = plan.total - planTotal;
  const balanced = Math.abs(remaining) <= 0.5;
  const instRows = rows.filter((r) => r.label !== "Booking money" && r.label !== "Down payment");
  const ends = instRows.reduce((m, r) => (r.due_date > m ? r.due_date : m), "");
  const lastAmt = instRows.at(-1)?.amount ?? 0;
  const e = calc.errors;
  const input = "admin-input mt-1";
  const Err = ({ m }: { m?: string | undefined }) => (m ? <p role="alert" className="mt-1 text-xs font-medium text-brand-red">{m}</p> : null);
  const money = (k: "total" | "booking", label: string) => (
    <label className="text-sm font-medium text-navy">{label}
      <input inputMode="numeric" value={plan[k] ? String(plan[k]) : ""} onChange={(ev) => setPlan({ [k]: num(ev.target.value) })} aria-invalid={!!e[k]} className={input} />
      <Err m={e[k]} />
    </label>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {money("total", "Total price (৳) *")}
          {money("booking", "Booking money (৳) *")}
          <label className="text-sm font-medium text-navy">Number of instalments *
            <input inputMode="numeric" value={plan.count ? String(plan.count) : ""} onChange={(ev) => setPlan({ count: Math.min(120, num(ev.target.value)) })} aria-invalid={!!e.count} className={input} />
            <Err m={e.count} />
          </label>
          <label className="text-sm font-medium text-navy">Frequency
            <select value={plan.freqMonths} onChange={(ev) => setPlan({ freqMonths: Number(ev.target.value) as PlanForm["freqMonths"] })} className={input}>{FREQ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label className="text-sm font-medium text-navy">First instalment date *
            <input type="date" value={plan.firstDue} onChange={(ev) => setPlan({ firstDue: ev.target.value })} className={input} />
            <Err m={e.firstDue} />
          </label>
          <label className="text-sm font-medium text-navy">Instalment amount (৳) <span className="font-normal text-muted-foreground">optional</span>
            <input inputMode="numeric" disabled={plan.downManual != null} placeholder={plan.downManual != null || !plan.instAmount ? (calc.each ? String(calc.each) : "") : ""} value={plan.downManual == null && plan.instAmount ? String(plan.instAmount) : ""} onChange={(ev) => setPlan({ instAmount: digits(ev.target.value) ? num(ev.target.value) : null })} aria-invalid={!!e.instAmount} className={`${input} disabled:opacity-60`} />
            <Err m={e.instAmount} />
          </label>
          <div className="text-sm font-medium text-navy">
            <div className="flex items-center justify-between gap-2">Down payment (৳)
              {plan.downManual == null
                ? <button type="button" onClick={() => setPlan({ downManual: Math.max(0, calc.down), instAmount: null })} className="text-xs font-normal text-brand-red underline">Edit manually</button>
                : <button type="button" onClick={() => setPlan({ downManual: null })} className="text-xs font-normal text-brand-red underline">Back to auto</button>}
            </div>
            {plan.downManual == null
              ? <input readOnly tabIndex={-1} value={calc.down.toLocaleString("en-IN")} aria-label="Down payment (calculated)" className={`${input} bg-muted/50`} />
              : <input inputMode="numeric" autoFocus value={String(plan.downManual)} onChange={(ev) => setPlan({ downManual: num(ev.target.value) })} aria-label="Down payment" aria-invalid={!!e.downManual} className={input} />}
            <Err m={e.downManual} />
          </div>
          <label className="text-sm font-medium text-navy">Down payment due date
            <input type="date" value={plan.downDue} onChange={(ev) => setPlan({ downDue: ev.target.value })} className={input} />
          </label>
          <label className="text-sm font-medium text-navy">Round instalments to
            <select value={plan.round} onChange={(ev) => setPlan({ round: Number(ev.target.value) as PlanForm["round"] })} className={input}>{ROUND.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="!text-lg text-navy">Schedule</h3>
            <div className="flex gap-2">
              {build ? <button type="button" onClick={() => setPending(plan)} className={btnSm}>Regenerate schedule</button> : dirty && <button type="button" onClick={() => { setKept(false); onChange({ plan, rows: calc.rows, dirty: false }); }} className={btnSm}>Regenerate</button>}
              <button type="button" onClick={() => onChange({ ...value, rows: [...rows, { due_date: plan.firstDue, amount: Math.max(0, remaining), label: "Instalment" }], dirty: true })} className={btnSm}><Plus className="h-4 w-4" /> Add row</button>
            </div>
          </div>
          {!rows.length ? <p className="text-sm text-muted-foreground">Fill in the fields above to build the schedule.</p> : (
            <ul className="space-y-2">
              {rows.map((r, i) => ({ r, i })).sort((a, b) => Number(!isExtra(a.r.label)) - Number(!isExtra(b.r.label))).map(({ r, i }) => {
                const paid = r.paid ?? 0, lock = paid > 0;
                return (
                <li key={r.id ?? `n${i}`} className={`grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-border p-2 sm:grid-cols-[150px_1fr_140px_auto] sm:border-0 sm:p-0 ${lock ? "sm:bg-ivory/60" : ""}`}>
                  {isExtra(r.label)
                    ? <span className="col-span-2 flex items-center px-3 text-sm text-muted-foreground sm:col-span-1">Up front · no date</span>
                    : <input type="date" value={r.due_date} disabled={lock} aria-label={`${r.label} due date`} onChange={(ev) => setRow(i, { due_date: ev.target.value })} className="admin-input col-span-2 disabled:opacity-70 sm:col-span-1" />}
                  <input value={r.label} aria-label="Label" onChange={(ev) => setRow(i, { label: ev.target.value })} className="admin-input col-span-2 sm:col-span-1" />
                  <div>
                    <input inputMode="numeric" value={String(r.amount)} aria-label={`${r.label} amount`} aria-invalid={r.amount < paid} onChange={(ev) => setRow(i, { amount: num(ev.target.value) })} className="admin-input" />
                    {lock && <p className={`mt-0.5 text-[11px] ${r.amount < paid ? "font-medium text-brand-red" : "text-muted-foreground"}`}>{r.amount < paid ? `Cannot be below ${taka(paid)} paid` : `${taka(paid)} paid`}</p>}
                  </div>
                  {lock
                    ? <span title="Paid — locked" className="inline-flex h-9 w-9 items-center justify-center text-navy"><Lock className="h-4 w-4" aria-label="Paid — locked" /></span>
                    : <button type="button" onClick={() => onChange({ ...value, rows: rows.filter((_, j) => j !== i), dirty: true })} className={btnDanger} aria-label={`Remove ${r.label}`}><Trash2 className="h-4 w-4" /></button>}
                </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <aside className="h-fit rounded-xl border border-border bg-ivory/60 p-4 text-sm lg:sticky lg:top-4" aria-live="polite">
        <h3 className="!text-lg text-navy">Summary</h3>
        <dl className="mt-3 space-y-2">
          {([
            ["Total price", taka(plan.total)],
            ["Booking money", taka(plan.booking)],
            ["Down payment", taka(rows.find((r) => r.label === "Down payment")?.amount ?? 0)],
            ["Instalments", instRows.length ? `${instRows.length} × ${taka(instRows[0]!.amount)}${lastAmt !== instRows[0]!.amount ? ` (last ${taka(lastAmt)})` : ""}` : "—"],
            ["Plan ends on", ends ? fmtDate(ends) : "—"],
            ["Plan total", taka(planTotal)],
          ] as const).map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-semibold text-navy">{v}</dd></div>)}
          <div className="flex justify-between gap-3 border-t border-border pt-2">
            <dt className="font-medium text-navy">Remaining to plan</dt>
            <dd className={`flex items-center gap-1 font-bold ${balanced ? "text-green-700" : "text-brand-red"}`}>{balanced && <CheckCircle2 className="h-4 w-4" aria-hidden />}{taka(balanced ? 0 : remaining)}</dd>
          </div>
        </dl>
      </aside>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Regenerate the schedule?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{build ? "Unpaid instalments will be rebuilt from the fields above. Paid and partly-paid instalments are kept." : "Your manual changes will be replaced."}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => { setKept(true); setPending(null); }} className={btnSm}>Keep my rows</button>
            <button type="button" onClick={() => { setKept(false); if (pending) onChange({ plan: pending, rows: gen(pending), dirty: !!build }); setPending(null); }} className="btn btn-primary !py-2">Regenerate</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
