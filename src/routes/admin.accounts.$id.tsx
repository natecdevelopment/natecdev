import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Download, KeyRound, UserX, FileText, Mail, Pencil, Plus, Trash2, Upload, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, Confirm, ListSkeleton, PageTitle, btnDanger, btnSm } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WhatsAppIcon } from "@/components/SiteChrome";
import { PaymentsTable, StatusChip, SummaryCards } from "@/components/ClientMoney";
import { PAYMENT_METHODS, PAYMENT_TYPES, fmtDate, printStatement, type ClientRow, type PaymentRow } from "@/lib/account";
import { allocatePayment, isExtra, lateFee, scheduleOrder, taka, todayIso, totalLateFee, type PlanForm } from "@/lib/money";
import { PaymentPlanForm, initialPlanState, planBlocker, type PlanState } from "@/components/admin/PaymentPlanForm";
import { inviteClient } from "@/lib/admin-accounts.functions";
import { DeleteLoginsDialog, type LoginTarget } from "@/components/admin/PortalLogins";
import { ADMIN_LOCK_TIP, DeleteAccountDialog, useAdminEmails, type DeleteTarget } from "@/components/admin/AccountAdmin";

export const Route = createFileRoute("/admin/accounts/$id")({ component: ClientDetail });

const today = () => new Date().toISOString().slice(0, 10);

/** Re-spreads the total of all payments over the schedule, oldest first, so paid amounts always match the payment records. */
async function reallocate(clientId: string) {
  const [i, p] = await Promise.all([
    supabase.from("instalments").select("id, due_date, amount, paid_amount").eq("client_id", clientId),
    supabase.from("payments").select("amount").eq("client_id", clientId),
  ]);
  const rows = (i.data ?? []).map((r) => ({ ...r, amount: Number(r.amount), paid_amount: 0 }));
  const total = (p.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const { allocations } = allocatePayment(rows, total);
  await Promise.all(rows.map((r) => {
    const v = allocations.find((a) => a.id === r.id)?.apply ?? 0;
    const old = (i.data ?? []).find((x) => x.id === r.id)?.paid_amount;
    return Number(old) === v ? null : supabase.from("instalments").update({ paid_amount: v }).eq("id", r.id);
  }));
}

function ClientDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const invite = useServerFn(inviteClient);
  const key = ["admin", "client", id];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data: c, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!c) return null;
      const [b, inst, live, pay, docs, notes, proj, prof] = await Promise.all([
        supabase.from("client_balances").select("*").eq("client_id", id).maybeSingle(),
        supabase.from("instalments").select("*").eq("client_id", id).order("due_date"),
        supabase.from("instalments_live").select("id, status").eq("client_id", id),
        supabase.from("payments").select("*").eq("client_id", id).order("paid_on", { ascending: false }),
        supabase.from("client_documents").select("*").eq("client_id", id).order("uploaded_at", { ascending: false }),
        supabase.from("client_notes").select("notes").eq("client_id", id).maybeSingle(),
        c.project_id ? supabase.from("projects").select("id, name, slug").eq("id", c.project_id).maybeSingle() : Promise.resolve({ data: null }),
        c.profile_id ? supabase.from("profiles").select("email, username").eq("id", c.profile_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      return {
        c: c as ClientRow, b: b.data, payments: (pay.data ?? []) as PaymentRow[], docs: docs.data ?? [], notes: notes.data?.notes ?? "",
        inst: (inst.data ?? []).map((r) => ({ ...r, status: live.data?.find((l) => l.id === r.id)?.status ?? r.status })),
        project: proj.data as { id: string; name: string; slug: string } | null, loginEmail: (prof.data as { email: string } | null)?.email ?? null, username: (prof.data as { username: string } | null)?.username ?? null,
      };
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["admin", "clients"] }); };
  const [payOpen, setPayOpen] = useState(false);
  const [editPay, setEditPay] = useState<PaymentRow | null>(null);
  const [editInfo, setEditInfo] = useState(false);
  const [delAcc, setDelAcc] = useState<DeleteTarget[] | null>(null);
  const [delLogin, setDelLogin] = useState<LoginTarget[] | null>(null);
  const admins = useAdminEmails();

  if (q.isLoading) return <ListSkeleton />;
  if (!q.data) return <Card><p>Client not found.</p><Link to="/admin/accounts" search={{ tab: "clients" }} className="btn btn-primary mt-4">Back</Link></Card>;
  const d = q.data, c = d.c;
  const lock = admins.has((d.loginEmail ?? c.email).toLowerCase());

  const waPhone = c.phone.replace(/\D/g, "").replace(/^0/, "880");
  const reminder = d.b?.next_due_date
    ? `Assalamu Alaikum ${c.full_name}, this is a friendly reminder from Natec Development Ltd. Your next instalment of ${taka(d.b.next_due_amount)} for ${d.project?.name ?? "your flat"}${c.flat_no ? ` (flat ${c.flat_no})` : ""} is due on ${fmtDate(d.b.next_due_date)}. Thank you.`
    : `Assalamu Alaikum ${c.full_name}, greetings from Natec Development Ltd.`;

  async function sendInvite() {
    try {
      const r = await invite({ data: { clientId: c.id, origin: window.location.origin } });
      if (r.status === "invited") toast.success(`Invite sent to ${c.email}`);
      else if (r.status === "already_linked") toast.message("This client is already linked to a login.");
      else {
        const { data: p } = await supabase.from("profiles").select("id").ilike("email", c.email).maybeSingle();
        if (p) {
          await supabase.from("clients").update({ profile_id: p.id }).eq("id", c.id);
          await supabase.from("profiles").update({ account_type: "client" }).eq("id", p.id);
          toast.success("This email already has an account — it is now linked to this client.");
          refresh();
        } else toast.error("This email already has an account. Link it from the General accounts tab.");
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not send the invite."); }
  }
  async function deletePayment(p: PaymentRow) {
    const { error } = await supabase.from("payments").delete().eq("id", p.id);
    if (error) return void toast.error(error.message);
    await reallocate(c.id); toast.success("Payment deleted"); refresh();
  }
  async function deleteClient() {
    const paths = d.docs.map((x) => x.storage_path);
    if (paths.length) await supabase.storage.from("client-docs").remove(paths);
    const { error } = await supabase.from("clients").delete().eq("id", c.id);
    if (error) return void toast.error(error.message);
    if (c.profile_id) await supabase.from("profiles").update({ account_type: "general" }).eq("id", c.profile_id);
    toast.success("Client deleted"); qc.invalidateQueries({ queryKey: ["admin"] }); navigate({ to: "/admin/accounts", search: { tab: "clients" } });
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/accounts" search={{ tab: "clients" }} className="inline-flex items-center gap-1 text-sm text-navy"><ArrowLeft className="h-4 w-4" /> Clients</Link>
      <PageTitle title={c.full_name}>
        <button onClick={() => setPayOpen(true)} className="btn btn-primary !py-2"><Wallet className="h-4 w-4" /> Record payment</button>
        <a href={`https://wa.me/${waPhone}?text=${encodeURIComponent(reminder)}`} target="_blank" rel="noreferrer" className={btnSm}><WhatsAppIcon /> WhatsApp reminder</a>
        <button onClick={() => printStatement({ client: c, projectName: d.project?.name ?? "", balance: d.b, instalments: d.inst, payments: d.payments })} className={btnSm}><Download className="h-4 w-4" /> Statement (PDF)</button>
        {!c.profile_id && <button onClick={sendInvite} disabled={!c.email} className={`${btnSm} disabled:opacity-40`} title={c.email ? "" : "Add an email first"}><Mail className="h-4 w-4" /> Invite to portal</button>}
        {c.profile_id && !lock && <Link to="/admin/accounts/create-logins" search={{ reset: c.id }} className={btnSm}><KeyRound className="h-4 w-4" /> Reset login</Link>}
        {c.profile_id && !lock && <button onClick={() => setDelLogin([{ clientId: c.id, name: c.full_name }])} className={btnDanger}><UserX className="h-4 w-4" /> Delete login</button>}
        <Link to="/admin/accounts/clients/$id/edit" params={{ id: c.id }} className={btnSm}><Pencil className="h-4 w-4" /> Edit</Link>
        <Confirm title="Delete this client?" description="This removes the client with all payments, schedule and documents. It cannot be undone." onConfirm={deleteClient}>
          {(ask) => <button onClick={ask} className={btnDanger}><Trash2 className="h-4 w-4" /> Delete</button>}
        </Confirm>
      </PageTitle>
      <Card className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {[["Project", d.project?.name ?? "—"], ["Flat / floor", `${c.flat_no || "—"} / ${c.floor || "—"}`], ["Size", c.size_sft ? `${c.size_sft.toLocaleString("en-IN")} sft` : "—"], ["Parking", c.parking ? "Yes" : "No"], ["Phone", c.phone], ["Email", c.email || "—"], ["Login", d.username ? `Username: ${d.username}` : d.loginEmail ?? "No login yet"], ["Status", c.status], ["Booking", fmtDate(c.booking_date)], ["Agreement", fmtDate(c.agreement_date)], ["Address", c.address || "—"], ["Plan note", c.payment_plan_note || "—"]].map(([k, v]) => (
          <div key={k}><p className="text-xs uppercase tracking-wider text-muted-foreground">{k}</p><p className="break-words font-medium text-navy">{v}</p></div>
        ))}
      </Card>
      <SummaryCards c={c} b={d.b} late={totalLateFee(d.inst, todayIso())} />

      <Schedule clientId={c.id} rows={d.inst} total={Number(c.total_price)} bookingDate={c.booking_date ?? ""} onChange={refresh} />

      <Card>
        <h2 className="mb-2 !text-xl text-navy">Payments</h2>
        <PaymentsTable rows={d.payments} actions={(p) => (
          <span className="flex gap-1.5">
            <button onClick={() => setEditPay(p)} className={btnSm} aria-label="Edit payment"><Pencil className="h-4 w-4" /></button>
            <Confirm title="Delete this payment?" description={`${taka(p.amount)} on ${fmtDate(p.paid_on)}`} onConfirm={() => deletePayment(p)}>
              {(ask) => <button onClick={ask} className={btnDanger} aria-label="Delete payment"><Trash2 className="h-4 w-4" /></button>}
            </Confirm>
          </span>
        )} />
        {d.payments.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Last change: {fmtDate(d.payments.reduce((m, p) => (p.updated_at > m ? p.updated_at : m), ""))}. Each payment stores who recorded it.</p>}
      </Card>

      <Docs clientId={c.id} docs={d.docs} onChange={refresh} />

      <Card>
        <h2 className="!text-xl text-navy">Admin notes</h2>
        <p className="text-xs text-muted-foreground">Only admins can see these.</p>
        {d.notes ? <div className="mt-3 whitespace-pre-wrap text-sm text-navy [&_ul]:list-disc [&_ul]:pl-5">{d.notes.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li)>/gi, "\n").replace(/<[^>]+>/g, "").trim()}</div> : <p className="mt-3 text-sm text-muted-foreground">No notes yet.</p>}
        <Link to="/admin/accounts/clients/$id/edit" params={{ id: c.id }} className={`${btnSm} mt-3`}><Pencil className="h-4 w-4" /> Edit notes</Link>
      </Card>

      <Card className="border border-brand-red/30">
        <h2 className="!text-xl text-brand-red">Danger zone</h2>
        <p className="mt-1 text-sm text-muted-foreground">{c.profile_id ? `Login: ${d.loginEmail ?? "linked"}` : "This client has no portal login."}</p>
        {(() => { return (
          <span title={lock ? ADMIN_LOCK_TIP : undefined} className="mt-3 inline-flex">
            <button disabled={lock} onClick={() => setDelAcc([{ profileId: c.profile_id, clientId: c.id, name: c.full_name, email: d.loginEmail ?? (c.email || c.phone), isClient: true }])} className={`${btnDanger} disabled:cursor-not-allowed disabled:opacity-40`}><Trash2 className="h-4 w-4" /> Delete account</button>
          </span>
        ); })()}
      </Card>
      <DeleteLoginsDialog targets={delLogin} onClose={() => setDelLogin(null)} onDone={refresh} />
      <DeleteAccountDialog targets={delAcc} onClose={() => setDelAcc(null)} onDeleted={(t) => { if (!t[0]?.profileId || !c.profile_id) navigate({ to: "/admin/accounts", search: { tab: "clients" } }); else refresh(); }} />

      <RecordPayment open={payOpen} onClose={() => setPayOpen(false)} clientId={c.id} inst={d.inst} onSaved={refresh} />
      <EditPayment p={editPay} onClose={() => setEditPay(null)} onSaved={async () => { await reallocate(c.id); refresh(); }} />
      <EditInfo open={editInfo} c={c} onClose={() => setEditInfo(false)} onSaved={refresh} />
    </div>
  );
}

type Inst = { id: string; due_date: string; amount: number; paid_amount: number; label: string; status: string };

function Schedule({ clientId, rows, total, bookingDate, onChange }: { clientId: string; rows: Inst[]; total: number; bookingDate: string; onChange: () => void }) {
  const [edit, setEdit] = useState<PlanState | null>(null);
  const [saving, setSaving] = useState(false);
  function openEdit() {
    const base = initialPlanState(bookingDate, total);
    const sorted = [...rows].sort((a, b) => a.due_date.localeCompare(b.due_date));
    const inst = sorted.filter((r) => r.label !== "Booking money" && r.label !== "Down payment");
    const down = sorted.find((r) => r.label === "Down payment");
    const plan: PlanForm = { ...base.plan, booking: Number(sorted.find((r) => r.label === "Booking money")?.amount ?? 0), count: inst.length || 24, firstDue: inst[0]?.due_date ?? base.plan.firstDue, downDue: down?.due_date ?? base.plan.downDue, instAmount: inst[0] ? Number(inst[0].amount) : null };
    setEdit(sorted.length ? { plan, rows: sorted.map((r) => ({ due_date: r.due_date, amount: Number(r.amount), label: r.label })), dirty: true } : { ...base, plan });
  }
  async function saveEdit() {
    if (!edit) return;
    const b = planBlocker(edit, bookingDate);
    if (b) return void toast.error(b);
    setSaving(true);
    try {
      if (edit.plan.total !== total) { const r = await supabase.from("clients").update({ total_price: edit.plan.total }).eq("id", clientId); if (r.error) throw r.error; }
      const d = await supabase.from("instalments").delete().eq("client_id", clientId); if (d.error) throw d.error;
      const ins = await supabase.from("instalments").insert(edit.rows.map((r) => ({ client_id: clientId, due_date: r.due_date, amount: Number(r.amount), label: r.label.trim() || "Instalment" }))); if (ins.error) throw ins.error;
      await reallocate(clientId);
      toast.success("Schedule saved"); setEdit(null); onChange();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save the schedule."); } finally { setSaving(false); }
  }
  const planned = rows.reduce((s, r) => s + Number(r.amount), 0);
  async function upd(id: string, patch: Partial<Inst>) {
    const { error } = await supabase.from("instalments").update(patch).eq("id", id);
    if (error) return void toast.error(error.message);
    await reallocate(clientId); onChange();
  }
  async function add() {
    const { error } = await supabase.from("instalments").insert({ client_id: clientId, due_date: today(), amount: Math.max(0, total - planned), label: "Instalment" });
    if (error) return void toast.error(error.message);
    await reallocate(clientId); onChange();
  }
  async function del(id: string) {
    await supabase.from("instalments").delete().eq("id", id);
    await reallocate(clientId); onChange();
  }
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="!text-xl text-navy">Instalment schedule</h2>
        <span className={`text-sm font-semibold ${Math.abs(total - planned) > 0.5 ? "text-brand-red" : "text-navy"}`}>Planned {taka(planned)} of {taka(total)}</span>
      </div>
      {!rows.length ? <p className="text-muted-foreground">No schedule yet.</p> : (
        <ul className="space-y-2">
          {scheduleOrder(rows).map((r) => (
            <li key={r.id} className="grid items-center gap-2 sm:grid-cols-[150px_1fr_150px_120px_auto_auto]">
              {isExtra(r.label)
                ? <span className="px-3 text-sm text-muted-foreground">Up front</span>
                : <input type="date" defaultValue={r.due_date} aria-label="Due date" onBlur={(e) => e.target.value && e.target.value !== r.due_date && upd(r.id, { due_date: e.target.value })} className="admin-input" />}
              <input defaultValue={r.label} aria-label="Label" onBlur={(e) => e.target.value !== r.label && upd(r.id, { label: e.target.value })} className="admin-input" />
              <input type="number" min={0} defaultValue={Number(r.amount)} aria-label="Amount" onBlur={(e) => Number(e.target.value) !== Number(r.amount) && upd(r.id, { amount: Number(e.target.value) })} className="admin-input" />
              <span className="text-xs text-muted-foreground">{taka(r.paid_amount)} paid{(() => { const lf = lateFee(r, todayIso()); return lf.fee > 0 ? <span className="block font-medium text-brand-red">Late fee {taka(lf.fee)} · {lf.days} days</span> : null; })()}</span>
              <StatusChip s={r.status} />
              <Confirm title="Delete this row?" description={`${r.label} — ${taka(r.amount)}`} onConfirm={() => del(r.id)}>
                {(ask) => <button onClick={ask} className={btnDanger} aria-label="Delete row"><Trash2 className="h-4 w-4" /></button>}
              </Confirm>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={add} className={btnSm}><Plus className="h-4 w-4" /> Add row</button>
        <button onClick={openEdit} className={btnSm}><Pencil className="h-4 w-4" /> Edit schedule</button>
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent data-lenis-prevent className="max-h-[92svh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>Edit schedule</DialogTitle></DialogHeader>
          {edit && <PaymentPlanForm value={edit} onChange={setEdit} bookingDate={bookingDate} />}
          <p className="text-xs text-muted-foreground">Saving replaces all schedule rows; payments already received are re-applied to the oldest rows first.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEdit(null)} className={btnSm}>Cancel</button>
            <button type="button" disabled={saving || !!(edit && planBlocker(edit, bookingDate))} onClick={saveEdit} className="btn btn-primary !py-2 disabled:opacity-50">{saving ? "Saving…" : "Save schedule"}</button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PaymentFields({ p }: { p?: Partial<PaymentRow> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium text-navy">Date<input name="paid_on" type="date" defaultValue={p?.paid_on ?? today()} className="admin-input mt-1" /></label>
      <label className="text-sm font-medium text-navy">Amount (৳)<input name="amount" type="number" min={1} step="0.01" defaultValue={p?.amount ?? ""} className="admin-input mt-1" /></label>
      <label className="text-sm font-medium text-navy">Type<select name="type" defaultValue={p?.type ?? "Instalment"} className="admin-input mt-1">{PAYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label className="text-sm font-medium text-navy">Method<select name="method" defaultValue={p?.method ?? "Cash"} className="admin-input mt-1">{PAYMENT_METHODS.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label className="text-sm font-medium text-navy">Reference<input name="reference" defaultValue={p?.reference ?? ""} className="admin-input mt-1" /></label>
      <label className="text-sm font-medium text-navy">Note<input name="note" defaultValue={p?.note ?? ""} className="admin-input mt-1" /></label>
    </div>
  );
}
const readPayment = (f: FormData) => ({ paid_on: String(f.get("paid_on")), amount: Number(f.get("amount")), type: String(f.get("type")), method: String(f.get("method")), reference: String(f.get("reference") || "").trim(), note: String(f.get("note") || "").trim() });

function RecordPayment({ open, onClose, clientId, inst, onSaved }: { open: boolean; onClose: () => void; clientId: string; inst: Inst[]; onSaved: () => void }) {
  const [amount, setAmount] = useState(0);
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const auto = useMemo(() => allocatePayment(inst.map((i) => ({ ...i, amount: Number(i.amount), paid_amount: Number(i.paid_amount) })), amount), [inst, amount]);
  const open_ = inst.filter((i) => Number(i.paid_amount) < Number(i.amount));
  const value = (id: string) => alloc[id] ?? auto.allocations.find((a) => a.id === id)?.apply ?? 0;
  const applied = open_.reduce((s, i) => s + value(i.id), 0);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const p = readPayment(new FormData(e.currentTarget));
    if (!(p.amount > 0) || !p.paid_on) return void toast.error("Enter a date and an amount.");
    if (applied > p.amount + 0.01) return void toast.error("Applied amounts are more than the payment.");
    setBusy(true);
    const { error } = await supabase.from("payments").insert({ ...p, client_id: clientId });
    if (!error) {
      await Promise.all(open_.map((i) => { const v = value(i.id); return v > 0 ? supabase.from("instalments").update({ paid_amount: Math.min(Number(i.amount), Number(i.paid_amount) + v) }).eq("id", i.id) : null; }));
    }
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Payment recorded"); setAlloc({}); setAmount(0); onSaved(); onClose();
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-lenis-prevent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
        <form onSubmit={submit} onChange={(e) => { const t = e.target as unknown as HTMLInputElement; if (t.name === "amount") { setAmount(Number(t.value) || 0); setAlloc({}); } }} className="space-y-4">
          <PaymentFields />
          {open_.length > 0 && amount > 0 && (
            <div>
              <p className="text-sm font-semibold text-navy">Applied to instalments (oldest first — you can change these)</p>
              <ul className="mt-2 space-y-1.5">
                {open_.map((i) => (
                  <li key={i.id} className="grid grid-cols-[1fr_130px] items-center gap-2 text-sm">
                    <span className="text-navy">{fmtDate(i.due_date)} · {i.label} <span className="text-muted-foreground">({taka(Number(i.amount) - Number(i.paid_amount))} open)</span></span>
                    <input type="number" min={0} max={Number(i.amount) - Number(i.paid_amount)} value={value(i.id)} onChange={(e) => setAlloc((a) => ({ ...a, [i.id]: Math.max(0, Math.min(Number(i.amount) - Number(i.paid_amount), Number(e.target.value) || 0)) }))} className="admin-input" aria-label={`Apply to ${i.label}`} />
                  </li>
                ))}
              </ul>
              <p className={`mt-2 text-sm ${applied > amount ? "text-brand-red" : "text-muted-foreground"}`}>Applied {taka(applied)} of {taka(amount)}</p>
            </div>
          )}
          <button disabled={busy} className="btn btn-primary disabled:opacity-60">{busy ? "Saving…" : "Save payment"}</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditPayment({ p, onClose, onSaved }: { p: PaymentRow | null; onClose: () => void; onSaved: () => void }) {
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = readPayment(new FormData(e.currentTarget));
    if (!(v.amount > 0)) return void toast.error("Enter an amount.");
    const { error } = await supabase.from("payments").update(v).eq("id", p!.id);
    if (error) return void toast.error(error.message);
    toast.success("Payment updated"); onSaved(); onClose();
  }
  return (
    <Dialog open={!!p} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-lenis-prevent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Edit payment</DialogTitle></DialogHeader>
        {p && <form onSubmit={submit} className="space-y-4"><PaymentFields p={p} /><p className="text-xs text-muted-foreground">Saving re-applies all payments to the schedule, oldest first.</p><button className="btn btn-primary">Save</button></form>}
      </DialogContent>
    </Dialog>
  );
}

function EditInfo({ open, c, onClose, onSaved }: { open: boolean; c: ClientRow; onClose: () => void; onSaved: () => void }) {
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) || "").trim();
    const { error } = await supabase.from("clients").update({
      full_name: g("full_name"), phone: g("phone"), email: g("email"), address: g("address"), flat_no: g("flat_no"), floor: g("floor"),
      size_sft: g("size_sft") ? Number(g("size_sft")) : null, parking: !!f.get("parking"), total_price: Number(g("total_price")) || 0,
      booking_date: g("booking_date") || null, agreement_date: g("agreement_date") || null, payment_plan_note: g("payment_plan_note"), status: g("status"),
    }).eq("id", c.id);
    if (error) return void toast.error(error.message);
    toast.success("Saved"); onSaved(); onClose();
  }
  const L = ({ k, l, t = "text", v }: { k: string; l: string; t?: string; v: string | number | null }) => <label className="text-sm font-medium text-navy">{l}<input name={k} type={t} defaultValue={v ?? ""} className="admin-input mt-1" /></label>;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-lenis-prevent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Edit client</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <L k="full_name" l="Full name" v={c.full_name} /><L k="phone" l="Phone" v={c.phone} /><L k="email" l="Email" t="email" v={c.email} /><L k="address" l="Address" v={c.address} />
          <L k="flat_no" l="Flat no." v={c.flat_no} /><L k="floor" l="Floor" v={c.floor} /><L k="size_sft" l="Size (sft)" t="number" v={c.size_sft} /><L k="total_price" l="Total price (৳)" t="number" v={c.total_price} />
          <L k="booking_date" l="Booking date" t="date" v={c.booking_date} /><L k="agreement_date" l="Agreement date" t="date" v={c.agreement_date} />
          <label className="flex items-center gap-2 text-sm font-medium text-navy"><input type="checkbox" name="parking" defaultChecked={c.parking} className="h-5 w-5" /> Car parking</label>
          <label className="text-sm font-medium text-navy">Status<select name="status" defaultValue={c.status} className="admin-input mt-1"><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
          <label className="text-sm font-medium text-navy sm:col-span-2">Payment plan note<textarea name="payment_plan_note" defaultValue={c.payment_plan_note} rows={2} className="admin-input mt-1" /></label>
          <div><button className="btn btn-primary">Save</button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Docs({ clientId, docs, onChange }: { clientId: string; docs: { id: string; title: string; storage_path: string; uploaded_at: string }[]; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const file = f.get("file") as File | null, title = String(f.get("title") || "").trim();
    if (!file || !file.size) return void toast.error("Choose a file.");
    setBusy(true);
    const path = `${clientId}/${crypto.randomUUID().slice(0, 8)}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-")}`;
    const up = await supabase.storage.from("client-docs").upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (!up.error) { const r = await supabase.from("client_documents").insert({ client_id: clientId, title: title || file.name, storage_path: path }); if (r.error) toast.error(r.error.message); else { toast.success("Document uploaded"); form.reset(); } }
    else toast.error(up.error.message);
    setBusy(false); onChange();
  }
  async function open(path: string) {
    const { data, error } = await supabase.storage.from("client-docs").createSignedUrl(path, 60);
    if (error || !data) return void toast.error("Couldn't open the file.");
    window.open(data.signedUrl, "_blank", "noopener");
  }
  async function del(d: { id: string; storage_path: string }) {
    await supabase.storage.from("client-docs").remove([d.storage_path]);
    await supabase.from("client_documents").delete().eq("id", d.id);
    onChange();
  }
  return (
    <Card>
      <h2 className="!text-xl text-navy">Documents</h2>
      <form onSubmit={upload} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input name="title" placeholder="Title (e.g. Allotment letter)" className="admin-input" />
        <input name="file" type="file" accept=".pdf,image/*,.doc,.docx" className="text-sm" aria-label="File" />
        <button disabled={busy} className="btn btn-primary !py-2 disabled:opacity-60"><Upload className="h-4 w-4" /> {busy ? "Uploading…" : "Upload"}</button>
      </form>
      {docs.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
              <button onClick={() => open(d.storage_path)} className="flex min-w-0 items-center gap-2 text-left text-navy hover:underline"><FileText className="h-4 w-4 shrink-0 text-brand-red" /><span className="truncate">{d.title}</span><span className="text-xs text-muted-foreground">{fmtDate(d.uploaded_at)}</span></button>
              <Confirm title="Delete this document?" description={d.title} onConfirm={() => del(d)}>{(ask) => <button onClick={ask} className={btnDanger} aria-label="Delete document"><Trash2 className="h-4 w-4" /></button>}</Confirm>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
