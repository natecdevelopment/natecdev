import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Bold, Check, FileText, Italic, List, Loader2, Mail, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, Confirm, ListSkeleton, btnDanger, btnSm } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaymentPlanForm, planBlocker, type PlanState } from "@/components/admin/PaymentPlanForm";
import { ADMIN_LOCK_TIP, DeleteAccountDialog, useAdminEmails, type DeleteTarget } from "@/components/admin/AccountAdmin";
import { normalizeBdPhone } from "@/components/InquiryForm";
import { inviteClient, updateLoginEmail } from "@/lib/admin-accounts.functions";
import { PAYMENT_METHODS, PAYMENT_TYPES, fmtDate, type ClientRow, type PaymentRow } from "@/lib/account";
import { guessPlan, rebuildKeepingPaid, scheduleOrder, taka, type ScheduleRow } from "@/lib/money";

export const Route = createFileRoute("/admin/accounts/clients/$id/edit")({
  head: () => ({ meta: [{ title: "Edit client — Natec Admin" }, { name: "robots", content: "noindex" }] }),
  component: ClientEditor,
});

const TABS = ["Client info", "Home", "Payment plan & schedule", "Payments", "Documents", "Notes"] as const;
type TabName = (typeof TABS)[number];
const today = () => new Date().toISOString().slice(0, 10);
const MAX_DOC = 20 * 1024 * 1024;

type Info = { full_name: string; phone: string; email: string; address: string; status: string; profile_id: string };
type Home = { project_id: string; flat_no: string; floor: string; size_sft: string; parking: boolean; booking_date: string; agreement_date: string };
type Form = { info: Info; home: Home; plan: PlanState; notes: string };

/** Keeps only simple formatting tags from admin notes. */
function cleanHtml(html: string) {
  if (typeof window === "undefined" || !html) return html ?? "";
  if (!/[<>]/.test(html)) return html.replace(/\n/g, "<br>");
  const doc = new DOMParser().parseFromString(html, "text/html");
  const ok = new Set(["B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "P", "BR", "DIV", "SPAN"]);
  const walk = (n: Element) => {
    for (const ch of [...n.children]) {
      if (!ok.has(ch.tagName)) { ch.replaceWith(...[...ch.childNodes]); continue; }
      for (const a of [...ch.attributes]) ch.removeAttribute(a.name);
      walk(ch);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

const rowKey = (r: ScheduleRow[]) => JSON.stringify(r.map((x) => [x.id ?? "", x.due_date, Number(x.amount), x.label]));

function ClientEditor() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const admins = useAdminEmails();
  const saveLoginEmail = useServerFn(updateLoginEmail);
  const invite = useServerFn(inviteClient);
  const key = ["admin", "client-editor", id];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data: c, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!c) return null;
      const [b, inst, pay, docs, notes, projects, accounts] = await Promise.all([
        supabase.from("client_balances").select("*").eq("client_id", id).maybeSingle(),
        supabase.from("instalments").select("*").eq("client_id", id).order("due_date"),
        supabase.from("payments").select("*").eq("client_id", id).order("paid_on", { ascending: false }),
        supabase.from("client_documents").select("*").eq("client_id", id).order("uploaded_at", { ascending: false }),
        supabase.from("client_notes").select("notes, updated_at").eq("client_id", id).maybeSingle(),
        supabase.from("projects").select("id, name").order("sort_order"),
        supabase.rpc("admin_accounts"),
      ]);
      return {
        c: c as ClientRow, b: b.data, inst: inst.data ?? [], payments: (pay.data ?? []) as PaymentRow[], docs: docs.data ?? [],
        notes: notes.data?.notes ?? "", notesAt: notes.data?.updated_at ?? null, projects: projects.data ?? [],
        accounts: (accounts.data ?? []) as { id: string; email: string; full_name: string; email_verified: boolean }[],
      };
    },
  });
  const refresh = async () => { await qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["admin", "clients"] }); qc.invalidateQueries({ queryKey: ["admin", "client", id] }); };

  const [tab, setTab] = useState<TabName>("Client info");
  const [init, setInit] = useState<Form | null>(null);
  const [f, setF] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [askEmail, setAskEmail] = useState(false);
  const [delAcc, setDelAcc] = useState<DeleteTarget[] | null>(null);
  const [mark, setMark] = useState<{ row: ScheduleRow; paid: boolean } | null>(null);

  // Build the form from saved data (first load, and again after each save)
  useEffect(() => {
    if (!q.data || f) return;
    const { c, inst } = q.data;
    const rows: ScheduleRow[] = scheduleOrder(inst.map((r) => ({ id: r.id, due_date: r.due_date, amount: Number(r.amount), label: r.label, paid: Number(r.paid_amount) })));
    const form: Form = {
      info: { full_name: c.full_name, phone: c.phone, email: c.email, address: c.address, status: c.status, profile_id: c.profile_id ?? "" },
      home: { project_id: c.project_id ?? "", flat_no: c.flat_no, floor: c.floor, size_sft: c.size_sft == null ? "" : String(c.size_sft), parking: c.parking, booking_date: c.booking_date ?? "", agreement_date: c.agreement_date ?? "" },
      plan: { plan: guessPlan(rows, c.booking_date ?? "", Number(c.total_price)), rows, dirty: true },
      notes: cleanHtml(q.data.notes),
    };
    setInit(form); setF(form);
  }, [q.data, f]);

  // Payments change what is paid: refresh the paid amounts (locks) without losing unsaved edits
  useEffect(() => {
    if (!q.data) return;
    const paid = new Map(q.data.inst.map((r) => [r.id, Number(r.paid_amount)]));
    const upd = (s: Form | null) => s && { ...s, plan: { ...s.plan, rows: s.plan.rows.map((r) => (r.id ? { ...r, paid: paid.get(r.id) ?? 0 } : r)) } };
    setF(upd); setInit(upd);
  }, [q.data?.inst]);

  const dirty = useMemo(() => {
    const d: Partial<Record<TabName, boolean>> = {};
    if (!f || !init) return d;
    d["Client info"] = JSON.stringify(f.info) !== JSON.stringify(init.info);
    d["Home"] = JSON.stringify(f.home) !== JSON.stringify(init.home);
    d["Payment plan & schedule"] = f.plan.plan.total !== init.plan.plan.total || rowKey(f.plan.rows) !== rowKey(init.plan.rows);
    d["Notes"] = f.notes !== init.notes;
    return d;
  }, [f, init]);
  const anyDirty = Object.values(dirty).some(Boolean);

  const errors = useMemo(() => {
    const e: { info: Partial<Record<keyof Info, string>>; home: Partial<Record<keyof Home, string>>; plan: string | null } = { info: {}, home: {}, plan: null };
    if (!f) return e;
    if (!f.info.full_name.trim()) e.info.full_name = "Enter the client's name.";
    if (!normalizeBdPhone(f.info.phone)) e.info.phone = "Enter a valid Bangladesh mobile number.";
    if (f.info.email && !/^\S+@\S+\.\S+$/.test(f.info.email.trim())) e.info.email = "Email looks wrong.";
    if (!f.home.project_id) e.home.project_id = "Choose a project.";
    if (f.home.size_sft && !(Number(f.home.size_sft) > 0)) e.home.size_sft = "Numbers only.";
    if (dirty["Payment plan & schedule"]) e.plan = planBlocker(f.plan, f.home.booking_date);
    return e;
  }, [f, dirty]);
  const tabErr: Partial<Record<TabName, boolean>> = { "Client info": Object.keys(errors.info).length > 0, Home: Object.keys(errors.home).length > 0, "Payment plan & schedule": !!errors.plan };
  const hasErr = Object.values(tabErr).some(Boolean);

  useBlocker({ shouldBlockFn: () => anyDirty && !saving && !window.confirm("You have unsaved changes. Leave without saving?"), enableBeforeUnload: () => anyDirty && !saving });

  const saveRef = useRef<() => void>(() => {});
  useEffect(() => {
    const h = (ev: KeyboardEvent) => { if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") { ev.preventDefault(); saveRef.current(); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  if (q.isLoading || (q.data && !f)) return <ListSkeleton />;
  if (!q.data || !f || !init) return <Card><p>Client not found.</p><Link to="/admin/accounts" search={{ tab: "clients" }} className="btn btn-primary mt-4">Back</Link></Card>;
  const d = q.data, c = d.c;
  const linked = d.accounts.find((a) => a.id === f.info.profile_id);
  const setInfo = (p: Partial<Info>) => setF({ ...f, info: { ...f.info, ...p } });
  const setHome = (p: Partial<Home>) => setF({ ...f, home: { ...f.home, ...p } });

  function trySave() {
    if (!anyDirty || saving) return;
    if (hasErr) { const t = TABS.find((x) => tabErr[x]); if (t) setTab(t); toast.error("Fix the highlighted fields first."); return; }
    if (f!.info.email.trim().toLowerCase() !== init!.info.email.trim().toLowerCase() && f!.info.profile_id && f!.info.profile_id === init!.info.profile_id && f!.info.email.trim()) return setAskEmail(true);
    void save(false);
  }
  saveRef.current = trySave;

  async function save(alsoLogin: boolean) {
    if (!f || !init) return;
    setAskEmail(false); setSaving(true);
    try {
      const changes: Record<string, { old: unknown; new: unknown }> = {};
      const cmp = (k: string, a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) changes[k] = { old: a, new: b }; };
      (Object.keys(f.info) as (keyof Info)[]).forEach((k) => cmp(k, init.info[k], f.info[k]));
      (Object.keys(f.home) as (keyof Home)[]).forEach((k) => cmp(k, init.home[k], f.home[k]));
      cmp("total_price", init.plan.plan.total, f.plan.plan.total);
      if (dirty["Payment plan & schedule"]) {
        const sum = (r: ScheduleRow[]) => r.reduce((s, x) => s + Number(x.amount), 0);
        changes["schedule"] = { old: { rows: init.plan.rows.length, total: sum(init.plan.rows), ends: init.plan.rows.at(-1)?.due_date ?? null }, new: { rows: f.plan.rows.length, total: sum(f.plan.rows), ends: [...f.plan.rows].sort((a, b) => a.due_date.localeCompare(b.due_date)).at(-1)?.due_date ?? null } };
      }
      if (dirty["Notes"]) changes["notes"] = { old: "(edited)", new: "(edited)" };
      const client = {
        full_name: f.info.full_name.trim(), phone: normalizeBdPhone(f.info.phone) ?? f.info.phone, email: f.info.email.trim(), address: f.info.address.trim(), status: f.info.status,
        profile_id: f.info.profile_id, project_id: f.home.project_id, flat_no: f.home.flat_no.trim(), floor: f.home.floor.trim(), size_sft: f.home.size_sft,
        parking: f.home.parking, booking_date: f.home.booking_date, agreement_date: f.home.agreement_date, total_price: f.plan.plan.total,
      };
      const { error } = await supabase.rpc("admin_save_client", {
        _client_id: c.id, _client: client as never,
        _rows: (dirty["Payment plan & schedule"] ? f.plan.rows.map((r) => ({ id: r.id ?? "", due_date: r.due_date, amount: Number(r.amount), label: r.label.trim() })) : null) as never,
        _notes: (dirty["Notes"] ? cleanHtml(f.notes) : null) as never, _changes: changes as never,
      });
      if (error) throw error;
      if (alsoLogin) {
        try { await saveLoginEmail({ data: { clientId: c.id, email: client.email } }); }
        catch (e) { toast.error(`Client saved, but the login email was not changed: ${e instanceof Error ? e.message : "error"}`); }
      }
      toast.success("Client updated");
      await refresh();
      setInit(null); setF(null);
      qc.invalidateQueries({ queryKey: ["admin", "accounts"] }); qc.invalidateQueries({ queryKey: ["admin", "audit"] }); qc.invalidateQueries({ queryKey: ["account"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save. Nothing was changed."); }
    finally { setSaving(false); }
  }

  async function sendInvite() {
    try {
      const r = await invite({ data: { clientId: c.id, origin: window.location.origin } });
      if (r.status === "invited") toast.success(`Invite sent to ${c.email}`);
      else if (r.status === "already_linked") toast.message("This client is already linked to a login.");
      else toast.error("This email already has an account — use “Change linked account” to link it.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not send the invite."); }
  }

  const strip: [string, string][] = [
    ["Project", d.projects.find((p) => p.id === c.project_id)?.name ?? "—"], ["Flat", c.flat_no || "—"], ["Total price", taka(c.total_price)],
    ["Paid", taka(d.b?.total_paid ?? 0)], ["Due", taka(d.b?.amount_due ?? c.total_price)],
    ["Next instalment", d.b?.next_due_date ? `${fmtDate(d.b.next_due_date)} · ${taka(d.b.next_due_amount)}` : "—"],
  ];
  const lockDel = admins.has((linked?.email ?? c.email).toLowerCase());

  return (
    <div className="pb-28">
      <Link to="/admin/accounts" search={{ tab: "clients" }} className="mb-3 inline-flex items-center gap-1 text-sm text-navy"><ArrowLeft className="h-4 w-4" /> Clients</Link>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="!text-3xl text-navy md:!text-4xl">{c.full_name}</h1>
        <Link to="/admin/accounts/$id" params={{ id: c.id }} className={btnSm}>Open client page</Link>
      </div>
      <Card className="mb-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-3 xl:grid-cols-6">
        {strip.map(([k, v]) => <div key={k} className="min-w-0"><p className="text-xs uppercase tracking-wider text-muted-foreground">{k}</p><p className="truncate font-semibold text-navy" title={v}>{v}</p></div>)}
      </Card>

      <div role="tablist" className="mb-5 flex gap-1 overflow-x-auto border-b border-border" data-lenis-prevent>
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`relative shrink-0 whitespace-nowrap px-3 py-2.5 text-sm ${tab === t ? "border-b-2 border-brand-red font-semibold text-navy" : "text-muted-foreground hover:text-navy"}`}>
            {t}
            {(dirty[t] || tabErr[t]) && <span aria-label={tabErr[t] ? "has errors" : "has changes"} className={`ml-1.5 inline-block h-2 w-2 rounded-full align-middle ${tabErr[t] ? "bg-brand-red" : "bg-navy"}`} />}
          </button>
        ))}
      </div>

      {tab === "Client info" && (
        <div className="space-y-5">
          <Card className="grid gap-4 md:grid-cols-2">
            <Field label="Full name *" err={errors.info.full_name}><input value={f.info.full_name} onChange={(e) => setInfo({ full_name: e.target.value })} className="admin-input" /></Field>
            <Field label="Phone *" err={errors.info.phone}><input value={f.info.phone} inputMode="tel" onChange={(e) => setInfo({ phone: e.target.value })} className="admin-input" /></Field>
            <Field label="Email" err={errors.info.email}><input type="email" value={f.info.email} onChange={(e) => setInfo({ email: e.target.value })} className="admin-input" /></Field>
            <Field label="Address"><input value={f.info.address} onChange={(e) => setInfo({ address: e.target.value })} className="admin-input" /></Field>
            <Field label="Status"><select value={f.info.status} onChange={(e) => setInfo({ status: e.target.value })} className="admin-input"><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></Field>
          </Card>
          <LoginLink linked={linked} accounts={d.accounts} profileId={f.info.profile_id} savedProfileId={c.profile_id} hasEmail={!!c.email} onPick={(pid) => setInfo({ profile_id: pid })} onInvite={sendInvite} />
          <Card className="border border-brand-red/30">
            <h2 className="!text-xl text-brand-red">Danger zone</h2>
            <p className="mt-1 text-sm text-muted-foreground">{c.profile_id ? `Login: ${linked?.email ?? "linked"}` : "This client has no portal login."}</p>
            <span title={lockDel ? ADMIN_LOCK_TIP : undefined} className="mt-3 inline-flex">
              <button disabled={lockDel} onClick={() => setDelAcc([{ profileId: c.profile_id, clientId: c.id, name: c.full_name, email: linked?.email ?? (c.email || c.phone), isClient: true }])} className={`${btnDanger} disabled:cursor-not-allowed disabled:opacity-40`}><Trash2 className="h-4 w-4" /> Delete account</button>
            </span>
          </Card>
        </div>
      )}

      {tab === "Home" && (
        <Card className="grid gap-4 md:grid-cols-2">
          <Field label="Project *" err={errors.home.project_id}><select value={f.home.project_id} onChange={(e) => setHome({ project_id: e.target.value })} className="admin-input"><option value="">Choose…</option>{d.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Flat no."><input value={f.home.flat_no} onChange={(e) => setHome({ flat_no: e.target.value })} className="admin-input" /></Field>
          <Field label="Floor"><input value={f.home.floor} onChange={(e) => setHome({ floor: e.target.value })} className="admin-input" /></Field>
          <Field label="Size (sft)" err={errors.home.size_sft}><input inputMode="numeric" value={f.home.size_sft} onChange={(e) => setHome({ size_sft: e.target.value.replace(/[^\d]/g, "") })} className="admin-input" /></Field>
          <Field label="Booking date"><input type="date" value={f.home.booking_date} onChange={(e) => setHome({ booking_date: e.target.value })} className="admin-input" /></Field>
          <Field label="Agreement date"><input type="date" value={f.home.agreement_date} onChange={(e) => setHome({ agreement_date: e.target.value })} className="admin-input" /></Field>
          <label className="flex items-center gap-3 text-sm font-medium text-navy"><input type="checkbox" checked={f.home.parking} onChange={(e) => setHome({ parking: e.target.checked })} className="h-5 w-5" /> Car parking</label>
        </Card>
      )}

      {tab === "Payment plan & schedule" && (
        <Card>
          <PaymentPlanForm value={f.plan} onChange={(plan) => setF({ ...f, plan })} bookingDate={f.home.booking_date} build={(p) => rebuildKeepingPaid(p, f.home.booking_date, f.plan.rows)}
            paidToggle={{ enabled: !dirty["Payment plan & schedule"], disabledReason: "Save your schedule changes first", onToggle: (row, paid) => setMark({ row, paid }) }} />
          <p className="mt-3 text-xs text-muted-foreground">Tick "Paid" to record a full or partial payment for a row (earlier unpaid rows are paid first); untick to undo a payment made this way. An overdue instalment with nothing paid gets a late fee of 0.06% per day; any partial payment stops it.</p>
          {errors.plan && <p role="alert" className="mt-2 text-sm font-medium text-brand-red">{errors.plan}</p>}
        </Card>
      )}

      {tab === "Payments" && <Payments clientId={c.id} rows={d.payments} onChange={refresh} />}
      {mark && <MarkPaidDialog clientId={c.id} target={mark.row} paid={mark.paid} inst={d.inst} payments={d.payments} onClose={() => setMark(null)} onDone={refresh} />}
      {tab === "Documents" && <Docs clientId={c.id} docs={d.docs} onChange={refresh} />}
      {tab === "Notes" && (
        <Card>
          <h2 className="!text-xl text-navy">Admin notes</h2>
          <p className="text-xs text-muted-foreground">Only admins can see these.{d.notesAt && ` Last edited ${fmtDate(d.notesAt)}.`}</p>
          <RichText value={f.notes} onChange={(notes) => setF({ ...f, notes })} />
        </Card>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 md:left-60 border-t border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-sm text-muted-foreground">{hasErr && anyDirty ? <span className="text-brand-red">Fix errors on the tabs marked red.</span> : anyDirty ? "Unsaved changes" : "No changes"}</span>
          <button type="button" disabled={!anyDirty || saving} onClick={() => setF(init)} className={`${btnSm} disabled:opacity-40`}>Discard changes</button>
          <button type="button" disabled={!anyDirty || hasErr || saving} onClick={trySave} title="Ctrl/Cmd + S" className="btn btn-primary !py-2 disabled:cursor-not-allowed disabled:opacity-40">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes</button>
        </div>
      </div>

      <Dialog open={askEmail} onOpenChange={(o) => !o && setAskEmail(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Also update the login email?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This client signs in as <strong className="text-navy">{linked?.email}</strong>. Change their login to <strong className="text-navy">{f.info.email.trim()}</strong> too?</p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button onClick={() => void save(false)} className={btnSm}>No, client record only</button>
            <button onClick={() => void save(true)} className="btn btn-primary !py-2">Yes, update login too</button>
          </div>
        </DialogContent>
      </Dialog>
      <DeleteAccountDialog targets={delAcc} onClose={() => setDelAcc(null)} onDeleted={(t) => { setInit(f); if (!t[0]?.profileId || !c.profile_id || t[0]?.clientId) navigate({ to: "/admin/accounts", search: { tab: "clients" } }); else { setF(null); void refresh(); } }} />
    </div>
  );
}

function Field({ label, err, children }: { label: string; err?: string | undefined; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-navy">
      <span className="mb-1 block">{label}</span>
      {children}
      {err && <span role="alert" className="mt-1 block text-xs font-medium text-brand-red">{err}</span>}
    </label>
  );
}

function LoginLink({ linked, accounts, profileId, savedProfileId, hasEmail, onPick, onInvite }: {
  linked?: { id: string; email: string; email_verified: boolean } | undefined; accounts: { id: string; email: string; full_name: string }[];
  profileId: string; savedProfileId: string | null; hasEmail: boolean; onPick: (id: string) => void; onInvite: () => void;
}) {
  const [search, setSearch] = useState<string | null>(null);
  const t = (search ?? "").trim().toLowerCase();
  const found = t.length >= 2 ? accounts.filter((a) => a.email.toLowerCase().includes(t) && a.id !== profileId).slice(0, 6) : [];
  return (
    <Card>
      <h2 className="!text-lg text-navy">Website login</h2>
      {profileId ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="break-all font-semibold text-navy">{linked?.email ?? "Linked account"}</span>
          {linked?.email_verified ? <span className="rounded-full bg-ok/10 px-2 py-0.5 text-xs font-medium text-ok">Verified</span> : <span className="rounded-full bg-brand-red/10 px-2 py-0.5 text-xs font-medium text-brand-red">Not verified</span>}
        </p>
      ) : <p className="mt-2 text-sm text-muted-foreground">No website account is linked.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setSearch(search == null ? "" : null)} className={btnSm}><Pencil className="h-4 w-4" /> Change linked account</button>
        {profileId && <button type="button" onClick={() => onPick("")} className={btnSm}><X className="h-4 w-4" /> Unlink</button>}
        {!profileId && !savedProfileId && <button type="button" disabled={!hasEmail} title={hasEmail ? "" : "Save an email first"} onClick={onInvite} className={`${btnSm} disabled:opacity-40`}><Mail className="h-4 w-4" /> Invite to portal</button>}
      </div>
      {search != null && (
        <div className="mt-3">
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts by email" aria-label="Search accounts by email" className="admin-input" />
          {found.length > 0 && <ul className="mt-2 space-y-1">{found.map((a) => <li key={a.id}><button type="button" onClick={() => { onPick(a.id); setSearch(null); }} className={`${btnSm} max-w-full truncate`}>{a.email}{a.full_name && ` — ${a.full_name}`}</button></li>)}</ul>}
          {t.length >= 2 && !found.length && <p className="mt-2 text-xs text-muted-foreground">No account found.</p>}
        </div>
      )}
      {profileId !== (savedProfileId ?? "") && <p className="mt-2 text-xs text-muted-foreground">The login change is applied when you save.</p>}
    </Card>
  );
}

function RichText({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value; }, [value]);
  const cmd = (c: string) => { document.execCommand(c); ref.current?.focus(); onChange(ref.current?.innerHTML ?? ""); };
  const B = ({ c, label, children }: { c: string; label: string; children: ReactNode }) => <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd(c)} aria-label={label} title={label} className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-navy hover:bg-ivory">{children}</button>;
  return (
    <div className="mt-3">
      <div className="mb-2 flex gap-1"><B c="bold" label="Bold"><Bold className="h-4 w-4" /></B><B c="italic" label="Italic"><Italic className="h-4 w-4" /></B><B c="insertUnorderedList" label="Bullet list"><List className="h-4 w-4" /></B></div>
      <div ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-multiline aria-label="Admin notes" onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)} className="admin-input min-h-40 [&_ul]:list-disc [&_ul]:pl-5" data-lenis-prevent />
    </div>
  );
}

function Payments({ clientId, rows, onChange }: { clientId: string; rows: PaymentRow[]; onChange: () => Promise<void> }) {
  const [edit, setEdit] = useState<Partial<PaymentRow> | null>(null);
  const [busy, setBusy] = useState(false);
  async function realloc() { const { error } = await supabase.rpc("admin_reallocate_payments", { _client_id: clientId }); if (error) throw error; }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = { paid_on: String(fd.get("paid_on")), amount: Number(fd.get("amount")), type: String(fd.get("type")), method: String(fd.get("method")), reference: String(fd.get("reference") || "").trim(), note: String(fd.get("note") || "").trim() };
    if (!v.paid_on) return void toast.error("Choose a date.");
    if (!(v.amount > 0)) return void toast.error("Enter an amount above 0.");
    setBusy(true);
    try {
      const r = edit?.id ? await supabase.from("payments").update(v).eq("id", edit.id) : await supabase.from("payments").insert({ ...v, client_id: clientId });
      if (r.error) throw r.error;
      await realloc();
      toast.success(edit?.id ? "Payment updated" : "Payment recorded"); setEdit(null); await onChange();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not save the payment."); } finally { setBusy(false); }
  }
  async function del(p: PaymentRow) {
    const { error } = await supabase.from("payments").delete().eq("id", p.id);
    if (error) return void toast.error(error.message);
    try { await realloc(); } catch { /* shown on next load */ }
    toast.success("Payment deleted"); await onChange();
  }
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="!text-xl text-navy">Payment history</h2>
        <button onClick={() => setEdit({})} className="btn btn-primary !py-2"><Plus className="h-4 w-4" /> Add payment</button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Payments are saved straight away and applied to the oldest unpaid instalments.</p>
      {!rows.length ? <p className="text-sm text-muted-foreground">No payments yet.</p> : (
        <ul className="divide-y divide-border text-sm">
          {rows.map((p) => (
            <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2.5 sm:grid-cols-[120px_140px_minmax(0,1fr)_auto]">
              <span className="text-muted-foreground">{fmtDate(p.paid_on)}</span>
              <span className="font-semibold text-navy">{taka(p.amount)}</span>
              <span className="col-span-2 truncate text-muted-foreground sm:col-span-1">{p.type} · {p.method}{p.reference && ` · ${p.reference}`}</span>
              <span className="flex gap-1.5">
                <button onClick={() => setEdit(p)} className={btnSm} aria-label="Edit payment"><Pencil className="h-4 w-4" /></button>
                <Confirm title="Delete this payment?" description={`${taka(p.amount)} on ${fmtDate(p.paid_on)}`} onConfirm={() => del(p)}>{(ask) => <button onClick={ask} className={btnDanger} aria-label="Delete payment"><Trash2 className="h-4 w-4" /></button>}</Confirm>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent data-lenis-prevent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit payment" : "Add payment"}</DialogTitle></DialogHeader>
          {edit && (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Date"><input name="paid_on" type="date" defaultValue={edit.paid_on ?? today()} className="admin-input" /></Field>
                <Field label="Amount (৳)"><input name="amount" type="number" min={1} step="0.01" defaultValue={edit.amount ?? ""} className="admin-input" /></Field>
                <Field label="Type"><select name="type" defaultValue={edit.type ?? "Instalment"} className="admin-input">{PAYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
                <Field label="Method"><select name="method" defaultValue={edit.method ?? "Cash"} className="admin-input">{PAYMENT_METHODS.map((t) => <option key={t}>{t}</option>)}</select></Field>
                <Field label="Reference"><input name="reference" defaultValue={edit.reference ?? ""} className="admin-input" /></Field>
                <Field label="Note"><input name="note" defaultValue={edit.note ?? ""} className="admin-input" /></Field>
              </div>
              <button disabled={busy} className="btn btn-primary disabled:opacity-60">{busy ? "Saving…" : "Save payment"}</button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Docs({ clientId, docs, onChange }: { clientId: string; docs: { id: string; title: string; storage_path: string; uploaded_at: string }[]; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [rename, setRename] = useState<{ id: string; title: string } | null>(null);
  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, fd = new FormData(form);
    const file = fd.get("file") as File | null, title = String(fd.get("title") || "").trim();
    if (!file || !file.size) return void toast.error("Choose a file.");
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) return void toast.error("Only PDF, JPG or PNG files.");
    if (file.size > MAX_DOC) return void toast.error("Files can be up to 20 MB.");
    setBusy(true);
    const path = `${clientId}/${crypto.randomUUID().slice(0, 8)}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-")}`;
    const up = await supabase.storage.from("client-docs").upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (up.error) toast.error(up.error.message);
    else { const r = await supabase.from("client_documents").insert({ client_id: clientId, title: title || file.name, storage_path: path }); if (r.error) toast.error(r.error.message); else { toast.success("Document uploaded"); form.reset(); } }
    setBusy(false); await onChange();
  }
  async function open(path: string) {
    const { data, error } = await supabase.storage.from("client-docs").createSignedUrl(path, 60);
    if (error || !data) return void toast.error("Couldn't open the file.");
    window.open(data.signedUrl, "_blank", "noopener");
  }
  async function saveName() {
    if (!rename?.title.trim()) return void toast.error("Enter a name.");
    const { error } = await supabase.from("client_documents").update({ title: rename.title.trim() }).eq("id", rename.id);
    if (error) return void toast.error(error.message);
    setRename(null); toast.success("Renamed"); await onChange();
  }
  async function del(d: { id: string; storage_path: string }) {
    await supabase.storage.from("client-docs").remove([d.storage_path]);
    const { error } = await supabase.from("client_documents").delete().eq("id", d.id);
    if (error) return void toast.error(error.message);
    toast.success("Document deleted"); await onChange();
  }
  return (
    <Card>
      <h2 className="!text-xl text-navy">Documents</h2>
      <p className="text-xs text-muted-foreground">PDF, JPG or PNG up to 20 MB. Changes here are saved straight away.</p>
      <form onSubmit={upload} className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <input name="title" placeholder="Title (e.g. Allotment letter)" className="admin-input" />
        <input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="text-sm" aria-label="File" />
        <button disabled={busy} className="btn btn-primary !py-2 disabled:opacity-60"><Upload className="h-4 w-4" /> {busy ? "Uploading…" : "Upload"}</button>
      </form>
      {!docs.length ? <p className="mt-4 text-sm text-muted-foreground">No documents yet.</p> : (
        <ul className="mt-4 divide-y divide-border">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
              {rename?.id === d.id ? (
                <span className="flex min-w-0 flex-1 gap-2">
                  <input autoFocus value={rename.title} onChange={(e) => setRename({ ...rename, title: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") void saveName(); if (e.key === "Escape") setRename(null); }} className="admin-input" aria-label="Document name" />
                  <button onClick={() => void saveName()} className={btnSm} aria-label="Save name"><Check className="h-4 w-4" /></button>
                  <button onClick={() => setRename(null)} className={btnSm} aria-label="Cancel"><X className="h-4 w-4" /></button>
                </span>
              ) : (
                <button onClick={() => open(d.storage_path)} className="flex min-w-0 items-center gap-2 text-left text-navy hover:underline"><FileText className="h-4 w-4 shrink-0 text-brand-red" /><span className="truncate">{d.title}</span><span className="shrink-0 text-xs text-muted-foreground">{fmtDate(d.uploaded_at)}</span></button>
              )}
              {rename?.id !== d.id && (
                <span className="flex shrink-0 gap-1.5">
                  <button onClick={() => setRename({ id: d.id, title: d.title })} className={btnSm} aria-label="Rename document"><Pencil className="h-4 w-4" /></button>
                  <Confirm title="Delete this document?" description={d.title} onConfirm={() => del(d)}>{(ask) => <button onClick={ask} className={btnDanger} aria-label="Delete document"><Trash2 className="h-4 w-4" /></button>}</Confirm>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Payments made with the "Paid" tick carry this reference, so unticking can find and undo them. */
const TICK_REF = "Marked paid";
type InstRow = { id: string; due_date: string; amount: number | string; paid_amount: number | string; label: string };

/**
 * Tick: records one payment covering the row and any earlier unpaid rows (payments always fill the oldest rows first).
 * Untick: reduces or removes payments made with the tick until this row (and later rows) are unpaid again.
 */
function MarkPaidDialog({ clientId, target, paid, inst, payments, onClose, onDone }: { clientId: string; target: ScheduleRow; paid: boolean; inst: InstRow[]; payments: PaymentRow[]; onClose: () => void; onDone: () => Promise<void> }) {
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState<string>("Cash");
  const [amountText, setAmountText] = useState("");
  const [busy, setBusy] = useState(false);
  const order = [...inst].sort((a, b) => a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id));
  const k = order.findIndex((r) => r.id === target.id);
  const upTo = order.slice(0, k + 1);
  const open = upTo.filter((r) => Number(r.paid_amount) < Number(r.amount));
  const payAmount = open.reduce((s, r) => s + Number(r.amount) - Number(r.paid_amount), 0);
  const before = order.slice(0, k).reduce((s, r) => s + Number(r.amount), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const excess = Math.max(0, totalPaid - before);
  const ticks = payments.filter((p) => p.reference === TICK_REF).sort((a, b) => b.paid_on.localeCompare(a.paid_on) || b.created_at.localeCompare(a.created_at));
  const tickTotal = ticks.reduce((s, p) => s + Number(p.amount), 0);
  const canUndo = tickTotal >= excess;
  const typeOf = (l: string) => ((PAYMENT_TYPES as readonly string[]).includes(l) ? l : "Instalment");
  const amount = amountText.trim() === "" ? payAmount : Number(amountText.replace(/[^\d]/g, ""));
  const partial = amount > 0 && amount < payAmount;

  async function go() {
    setBusy(true);
    try {
      if (paid) {
        const r = await supabase.from("payments").insert({ client_id: clientId, paid_on: date, amount, type: typeOf(target.label), method, reference: TICK_REF, note: partial ? `Partial payment towards: ${open.map((x) => x.label).join(", ")}` : `Marked as paid: ${open.map((x) => x.label).join(", ")}` });
        if (r.error) throw r.error;
      } else {
        let left = excess;
        for (const p of ticks) {
          if (left <= 0) break;
          const amt = Number(p.amount);
          const r = amt <= left ? await supabase.from("payments").delete().eq("id", p.id) : await supabase.from("payments").update({ amount: amt - left }).eq("id", p.id);
          if (r.error) throw r.error;
          left -= Math.min(amt, left);
        }
      }
      const re = await supabase.rpc("admin_reallocate_payments", { _client_id: clientId });
      if (re.error) throw re.error;
      toast.success(paid ? (partial ? `Recorded a partial payment of ${taka(amount)}` : `Recorded ${taka(amount)} — ${target.label} marked paid`) : `${target.label} marked as not paid`);
      await onDone(); onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update."); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{paid ? `Payment for "${target.label}"` : `Mark "${target.label}" as not paid?`}</DialogTitle></DialogHeader>
        {paid ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Still to pay{open.length > 1 ? <> for {open.map((x) => x.label).join(", ")} (earlier unpaid rows are paid first)</> : null}: <b className="text-navy">{taka(payAmount)}</b>.</p>
            <label className="block font-medium text-navy">Amount received (৳)
              <input inputMode="numeric" value={amountText} placeholder={String(payAmount)} onChange={(e) => setAmountText(e.target.value.replace(/[^\d]/g, ""))} className="admin-input mt-1" />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">{partial ? `Partial payment — ${taka(payAmount - amount)} will still be due. A partly-paid instalment gets no late fee.` : "Leave as is for the full amount, or enter less for a partial payment."}</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="font-medium text-navy">Paid on<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="admin-input mt-1" /></label>
              <label className="font-medium text-navy">Method<select value={method} onChange={(e) => setMethod(e.target.value)} className="admin-input mt-1">{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>
            </div>
          </div>
        ) : canUndo ? (
          <p className="text-sm text-muted-foreground">{taka(excess)} of the payments made with the "Paid" tick will be removed, so this row{order.length - 1 > k ? " and the rows after it" : ""} become unpaid.</p>
        ) : (
          <p className="text-sm text-brand-red">This row is paid by payments recorded in Payment history ({taka(excess - tickTotal)} more than the "Paid" ticks). Edit or delete those payments in the Payments tab instead.</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className={btnSm}>Cancel</button>
          {(paid ? payAmount > 0 && amount > 0 && !!date : canUndo && excess > 0) && <button disabled={busy} onClick={go} className="btn btn-primary !py-2 disabled:opacity-50">{busy ? "Saving…" : paid ? (partial ? "Record partial payment" : "Record payment") : "Mark not paid"}</button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
