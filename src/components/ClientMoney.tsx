import { motion, useReducedMotion } from "framer-motion";
import { fmtDate, type BalanceRow, type ClientRow, type InstalmentRow, type PaymentRow } from "@/lib/account";
import { isExtra, lateFee, scheduleOrder, taka, todayIso } from "@/lib/money";

export function PaidRing({ pct }: { pct: number }) {
  const reduce = useReducedMotion();
  const r = 54, c = 2 * Math.PI * r;
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="12" className="stroke-navy/10" />
        <motion.circle cx="64" cy="64" r={r} fill="none" strokeWidth="12" strokeLinecap="round" className="stroke-brand-red" strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - pct / 100) : c }} animate={{ strokeDashoffset: c * (1 - Math.min(100, pct) / 100) }} transition={{ duration: reduce ? 0 : 1.2 }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-3xl text-navy">{Math.round(pct)}%</span><span className="text-[10px] uppercase tracking-widest text-muted-foreground">paid</span></div>
    </div>
  );
}

/** `late` = total late fee (0.06%/day on overdue instalments with nothing paid). */
export function SummaryCards({ c, b, late = 0 }: { c: ClientRow; b: BalanceRow | null; late?: number }) {
  const overdue = Number(b?.overdue_amount ?? 0) > 0;
  const cards: [string, string, (string | undefined)?, (boolean | undefined)?][] = [
    ["Total price", taka(c.total_price)],
    ["Paid so far", taka(b?.total_paid ?? 0)],
    ["Amount due", taka(b?.amount_due ?? c.total_price), late > 0 ? `+ ${taka(late)} late fee` : undefined, late > 0],
    ["Next instalment", b?.next_due_date ? taka(b.next_due_amount) : "—", b?.next_due_date ? `${overdue ? "Overdue since " : "Due "}${fmtDate(b.next_due_date)}` : undefined, overdue],
    ["Last payment", b?.last_payment_on ? taka(b.last_payment_amount) : "—", b?.last_payment_on ? fmtDate(b.last_payment_on) : undefined],
    ...(late > 0 ? [["Late fee", taka(late), "0.06% per day on unpaid overdue instalments", true] as [string, string, string, boolean]] : []),
  ];
  return (
    <div className={`grid grid-cols-2 gap-3 ${late > 0 ? "md:grid-cols-3 xl:grid-cols-6" : "xl:grid-cols-5"}`}>
      {cards.map(([k, v, sub, red]) => (
        <div key={k} className={`rounded-2xl bg-white p-5 shadow-sm ${red ? "ring-2 ring-brand-red" : ""}`}>
          <p className="eyebrow !text-[10px] text-muted-foreground">{k}</p>
          <p className={`mt-2 whitespace-nowrap font-display text-lg md:text-xl 2xl:text-2xl ${red ? "text-brand-red" : "text-navy"}`}>{v}</p>
          {sub && <p className={`mt-1 text-xs ${red ? "font-semibold text-brand-red" : "text-muted-foreground"}`}>{sub}</p>}
        </div>
      ))}
    </div>
  );
}

export function StatusChip({ s }: { s: string }) {
  const t = s === "Paid" ? "bg-navy text-white" : s === "Overdue" ? "bg-brand-red text-white" : s === "Partly paid" ? "border border-brand-red text-brand-red" : "bg-muted text-navy";
  return <span className={`font-label whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${t}`}>{s}</span>;
}

export function ScheduleTable({ rows }: { rows: InstalmentRow[] }) {
  if (!rows.length) return <p className="text-muted-foreground">No instalment schedule yet.</p>;
  return (
    <ul className="divide-y divide-border">
      {scheduleOrder(rows.map((r) => ({ ...r, label: r.label ?? "", due_date: r.due_date ?? "" }))).map((i) => (
        <li key={i.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 py-3 md:grid-cols-[130px_1fr_160px_110px] md:items-center">
          <span className="text-sm text-muted-foreground md:order-none">{isExtra(i.label) ? "Up front" : fmtDate(i.due_date)}</span>
          <span className="justify-self-end md:hidden"><StatusChip s={i.status ?? ""} /></span>
          <span className="text-navy">{i.label}</span>
          <span className="justify-self-end font-semibold text-navy md:justify-self-start">{taka(i.amount)}{Number(i.paid_amount) > 0 && Number(i.paid_amount) < Number(i.amount) ? <span className="block text-xs font-normal text-muted-foreground">{taka(i.paid_amount)} paid</span> : null}{(() => { const lf = lateFee({ ...i, amount: Number(i.amount) }, todayIso()); return lf.fee > 0 ? <span className="block text-xs font-medium text-brand-red">Late fee {taka(lf.fee)} · {lf.days} days</span> : null; })()}</span>
          <span className="hidden md:block"><StatusChip s={i.status ?? ""} /></span>
        </li>
      ))}
    </ul>
  );
}

export function PaymentsTable({ rows, actions }: { rows: PaymentRow[]; actions?: (p: PaymentRow) => React.ReactNode }) {
  if (!rows.length) return <p className="text-muted-foreground">No payments recorded yet.</p>;
  return (
    <ul className="divide-y divide-border">
      {rows.map((p) => (
        <li key={p.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 py-3 md:grid-cols-[130px_1fr_100px_1fr_150px_auto] md:items-center">
          <span className="text-sm text-muted-foreground">{fmtDate(p.paid_on)}</span>
          <span className="justify-self-end font-semibold text-navy md:order-5 md:justify-self-end">{taka(p.amount)}</span>
          <span className="text-navy">{p.type}</span>
          <span className="text-sm text-muted-foreground">{p.method}</span>
          <span className="col-span-2 truncate text-sm text-muted-foreground md:col-span-1">{p.reference || "—"}</span>
          {actions && <span className="col-span-2 md:order-6 md:col-span-1">{actions(p)}</span>}
        </li>
      ))}
    </ul>
  );
}

