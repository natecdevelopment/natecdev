import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { taka } from "@/lib/money";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
export type InstalmentRow = Database["public"]["Views"]["instalments_live"]["Row"];
export type BalanceRow = Database["public"]["Views"]["client_balances"]["Row"];
export type DocRow = Database["public"]["Tables"]["client_documents"]["Row"];

export const PAYMENT_TYPES = ["Booking money", "Down payment", "Instalment", "Car parking", "Other", "Late fee"] as const;
/** Late fee payments are kept separately: never applied to instalments or the amount due. */
export const LATE_FEE_TYPE = "Late fee";
export const PAYMENT_METHODS = ["Cash", "Bank", "Cheque", "bKash", "Nagad", "Other"] as const;

/** Client-side session (null while loading = undefined). */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export const initials = (name: string, email = "") =>
  (name.trim() ? name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") : email.slice(0, 2)).toUpperCase();

export const fmtDate = (d?: string | null) =>
  d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

/** Safe redirect target: same-origin path only. */
export const safeNext = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/account");

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Opens a printable statement; the browser's "Save as PDF" produces the file. */
export function printStatement(o: { client: ClientRow; projectName: string; balance: BalanceRow | null; instalments: InstalmentRow[]; payments: PaymentRow[] }) {
  const { client: c, balance: b } = o;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Statement — ${esc(c.full_name)}</title>
<style>body{font-family:Jost,Arial,sans-serif;color:#072F63;margin:32px}h1{font-family:'Playfair Display',Georgia,serif;margin:0}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}th{background:#F7F4EE}.r{text-align:right}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.box{background:#F7F4EE;padding:10px;border-radius:8px}.lbl{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#555}h2{margin-top:24px;font-size:16px;border-left:4px solid #9B0707;padding-left:8px}</style></head><body>
<img src="${location.origin}/brand/natec-logo-transparent.png" style="height:64px" alt="Natec Development Ltd.">
<h1>Account statement</h1><p>${esc(c.full_name)} · ${esc(o.projectName)} · Flat ${esc(c.flat_no)}${c.floor ? `, floor ${esc(c.floor)}` : ""}<br>Generated ${esc(fmtDate(new Date().toISOString()))}</p>
<div class="grid"><div class="box"><div class="lbl">Total price</div>${taka(c.total_price)}</div><div class="box"><div class="lbl">Paid so far</div>${taka(b?.total_paid)}</div><div class="box"><div class="lbl">Amount due</div>${taka(b?.amount_due ?? c.total_price)}</div></div>
<h2>Instalment schedule</h2><table><tr><th>Due date</th><th>Label</th><th class="r">Amount</th><th class="r">Paid</th><th>Status</th></tr>
${o.instalments.map((i) => `<tr><td>${fmtDate(i.due_date)}</td><td>${esc(i.label)}</td><td class="r">${taka(i.amount)}</td><td class="r">${taka(i.paid_amount)}</td><td>${esc(i.status)}</td></tr>`).join("")}</table>
<h2>Payment history</h2><table><tr><th>Date</th><th>Type</th><th>Method</th><th>Reference</th><th class="r">Amount</th></tr>
${o.payments.map((p) => `<tr><td>${fmtDate(p.paid_on)}</td><td>${esc(p.type)}</td><td>${esc(p.method)}</td><td>${esc(p.reference)}</td><td class="r">${taka(p.amount)}</td></tr>`).join("")}</table>
<p style="margin-top:24px;font-size:12px;color:#555">Records are maintained by Natec Development's accounts team. For corrections, contact us.</p>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
}
