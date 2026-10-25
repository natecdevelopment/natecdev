import { DeleteLoginsDialog, type LoginTarget } from "@/components/admin/PortalLogins";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, UserCheck, UserX, Eye, Trash2, MoreHorizontal, Briefcase, FileSpreadsheet, KeyRound } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActivityList, ADMIN_LOCK_TIP, DeleteAccountDialog, IconBtn, StatusChip, logAudit, muted, useAdminEmails, type DeleteTarget } from "@/components/admin/AccountAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Card, Empty, ListSkeleton, PageTitle, btnSm, btnDanger } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDate } from "@/lib/account";
import { taka } from "@/lib/money";
import { normalizeBdPhone } from "@/components/InquiryForm";

type Tab = "general" | "clients";
export const Route = createFileRoute("/admin/accounts/")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => (s["tab"] === "clients" ? { tab: "clients" } : {}),
  component: AccountsPage,
});

function AccountsPage() {
  const { tab = "general" } = Route.useSearch();
  return (
    <div>
      <PageTitle title="Accounts">
        <Link to="/admin/accounts" search={{}} className={`${btnSm} ${tab === "general" ? "!bg-navy !text-white" : ""}`}>General accounts</Link>
        <Link to="/admin/accounts" search={{ tab: "clients" }} className={`${btnSm} ${tab === "clients" ? "!bg-navy !text-white" : ""}`}>Client accounts</Link>
        <Link to="/admin/accounts/import" className={btnSm}><FileSpreadsheet className="h-3.5 w-3.5" /> Import from Excel</Link>
        <Link to="/admin/accounts/create-logins" className={btnSm}><KeyRound className="h-3.5 w-3.5" /> Create logins</Link>
        <Link to="/admin/accounts/new" search={{}} className="btn btn-primary !py-2"><Plus className="h-4 w-4" /> Add client</Link>
      </PageTitle>
      {tab === "general" ? <General /> : <Clients />}
      <ActivityList />
    </div>
  );
}

const PAGE = 20;
type Acc = { id: string; full_name: string; phone: string; email: string; account_type: string; status: string; created_at: string; last_seen_at: string | null; email_verified: boolean };

function General() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const admins = useAdminEmails();
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)); }, []);
  const q = useQuery({ queryKey: ["admin", "accounts"], queryFn: async () => { const { data, error } = await supabase.rpc("admin_accounts"); if (error) throw error; return (data ?? []) as Acc[]; } });
  const links = useQuery({ queryKey: ["admin", "client-links"], queryFn: async () => (await supabase.from("clients").select("id, profile_id").not("profile_id", "is", null)).data ?? [] });
  const clientOf = (a: Acc) => links.data?.find((l) => l.profile_id === a.id)?.id;
  const [term, setTerm] = useState(""); const [filter, setFilter] = useState("all"); const [sort, setSort] = useState<"joined" | "name" | "seen">("joined"); const [page, setPage] = useState(0);
  const [view, setView] = useState<Acc | null>(null); const [edit, setEdit] = useState<Acc | null>(null);
  const [del, setDel] = useState<DeleteTarget[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    let r = (q.data ?? []).filter((a) => !t || [a.full_name, a.email, a.phone].some((v) => v.toLowerCase().includes(t)));
    if (filter === "suspended") r = r.filter((a) => a.status === "suspended");
    if (filter === "unverified") r = r.filter((a) => !a.email_verified);
    if (filter === "client") r = r.filter((a) => a.account_type === "client");
    if (filter === "general") r = r.filter((a) => a.account_type === "general");
    return [...r].sort((a, b) => sort === "name" ? a.full_name.localeCompare(b.full_name) : sort === "seen" ? (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? "") : b.created_at.localeCompare(a.created_at));
  }, [q.data, term, filter, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const locked = (a: Acc) => admins.has(a.email.toLowerCase()) || a.id === me;
  const target = (a: Acc): DeleteTarget => ({ profileId: a.id, clientId: null, name: a.full_name, email: a.email, isClient: a.account_type === "client" });
  const deletable = shown.filter((a) => !locked(a));

  async function setStatus(a: Acc, status: "active" | "suspended") {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", a.id);
    if (error) return void toast.error(error.message);
    await logAudit(status === "suspended" ? "suspend" : "reactivate", a.email);
    toast.success(status === "suspended" ? "Account suspended" : "Account reactivated");
    qc.invalidateQueries({ queryKey: ["admin", "accounts"] });
    qc.invalidateQueries({ queryKey: ["admin", "audit"] });
  }
  function onDeleted(done: DeleteTarget[]) {
    const ids = new Set(done.map((d) => d.profileId));
    qc.setQueryData<Acc[]>(["admin", "accounts"], (old) => (old ?? []).filter((a) => !ids.has(a.id)));
    setPicked((p) => new Set([...p].filter((id) => !ids.has(id))));
    setView(null);
  }
  const togglePick = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const actions = (a: Acc) => [
    { key: "view", label: "View", icon: Eye, run: () => setView(a) },
    { key: "edit", label: "Edit", icon: Pencil, run: () => { const cid = a.account_type === "client" ? clientOf(a) : undefined; if (cid) navigate({ to: "/admin/accounts/clients/$id/edit", params: { id: cid } }); else setEdit(a); } },
    a.status === "active"
      ? { key: "sus", label: "Suspend", icon: UserX, danger: true, run: () => setStatus(a, "suspended") }
      : { key: "sus", label: "Reactivate", icon: UserCheck, run: () => setStatus(a, "active") },
    ...(a.account_type !== "client" ? [{ key: "client", label: "Make client", icon: Briefcase, run: () => navigate({ to: "/admin/accounts/new", search: { profile: a.id } }) }] : []),
    { key: "del", label: "Delete", icon: Trash2, danger: true, disabled: locked(a), tip: locked(a) ? ADMIN_LOCK_TIP : "Delete", run: () => setDel([target(a)]) },
  ];
  const nameCell = (a: Acc) => (
    <span className="flex min-w-0 items-center gap-2">
      {a.full_name ? <span className="truncate font-semibold text-navy">{a.full_name}</span> : <span className="truncate text-muted-foreground">{a.email.split("@")[0]}</span>}
      {a.account_type === "client" && <span className="shrink-0 rounded-full bg-navy px-2 py-0.5 text-[10px] text-white">Client</span>}
    </span>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <label className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={term} onChange={(e) => { setTerm(e.target.value); setPage(0); }} placeholder="Search name, email or phone" aria-label="Search accounts" className="admin-input !pl-9" /></label>
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }} aria-label="Filter" className="admin-input !w-auto">
          <option value="all">All</option><option value="general">General</option><option value="client">Clients</option><option value="unverified">Email not verified</option><option value="suspended">Suspended</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort" className="admin-input !w-auto">
          <option value="joined">Newest first</option><option value="name">Name A–Z</option><option value="seen">Last seen</option>
        </select>
        {picked.size > 0 && (
          <button onClick={() => setDel((q.data ?? []).filter((a) => picked.has(a.id) && !locked(a)).map(target))} className={btnDanger}><Trash2 className="h-4 w-4" /> Delete selected ({picked.size})</button>
        )}
      </div>
      {q.isLoading ? <ListSkeleton /> : q.error ? <Card><p className="text-brand-red">Could not load accounts.</p></Card> : !rows.length ? <Empty title="No accounts found" /> : (
        <Card className="!p-0 overflow-hidden">
          {/* Desktop: real table so columns line up */}
          <div className="hidden lg:block" data-lenis-prevent>
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-10" /><col className="w-[44%]" /><col className="w-[56%]" /><col className="w-[112px]" /><col className="w-[96px]" /><col className="w-[96px]" /><col className="w-[64px]" /><col className="w-[88px]" /><col className="w-[172px]" />
              </colgroup>
              <thead className="whitespace-nowrap border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-3"><input type="checkbox" aria-label="Select all on this page" checked={deletable.length > 0 && deletable.every((a) => picked.has(a.id))} onChange={(e) => setPicked(e.target.checked ? new Set([...picked, ...deletable.map((a) => a.id)]) : new Set([...picked].filter((id) => !deletable.some((a) => a.id === id))))} /></th>
                  <th className="px-2 py-3">Name</th><th className="px-2 py-3">Email</th><th className="px-2 py-3">Phone</th><th className="px-2 py-3">Joined</th><th className="px-2 py-3">Last seen</th><th className="px-2 py-3">Verified</th><th className="px-2 py-3">Status</th><th className="px-2 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((a) => (
                  <tr key={a.id} className="align-middle">
                    <td className="px-2 py-3"><input type="checkbox" aria-label={`Select ${a.email}`} disabled={locked(a)} title={locked(a) ? ADMIN_LOCK_TIP : undefined} checked={picked.has(a.id)} onChange={() => togglePick(a.id)} /></td>
                    <td className="px-2 py-3">{nameCell(a)}</td>
                    <td className="px-2 py-3"><span className="block truncate whitespace-nowrap text-muted-foreground" title={a.email}>{a.email}</span></td>
                    <td className="px-2 py-3 whitespace-nowrap text-muted-foreground">{a.phone || muted}</td>
                    <td className="px-2 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(a.created_at)}</td>
                    <td className="px-2 py-3 whitespace-nowrap text-muted-foreground">{a.last_seen_at ? fmtDate(a.last_seen_at) : muted}</td>
                    <td className="px-2 py-3"><span className={a.email_verified ? "text-navy" : "text-brand-red"}>{a.email_verified ? "Yes" : "No"}</span></td>
                    <td className="px-2 py-3"><StatusChip status={a.status} /></td>
                    <td className="px-2 py-3">
                      <span className="flex flex-nowrap justify-end gap-1">
                        {actions(a).map((x) => <IconBtn compact key={x.key} label={`${x.label} ${a.email}`} title={x.tip ?? x.label} danger={!!x.danger} disabled={!!x.disabled} onClick={() => void x.run()}><x.icon className="h-4 w-4" /></IconBtn>)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Under 1024px: cards with a ⋯ menu */}
          <ul className="divide-y divide-border lg:hidden">
            {shown.map((a) => (
              <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <div className="min-w-0">{nameCell(a)}</div>
                <DropdownMenu>
                  <DropdownMenuTrigger className="row-span-3 flex h-9 w-9 items-center justify-center self-start rounded-full border border-navy/20 text-navy" aria-label={`Actions for ${a.email}`}><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {actions(a).map((x) => (
                      <DropdownMenuItem key={x.key} disabled={!!x.disabled} onSelect={() => void x.run()} className={x.danger ? "text-brand-red" : ""} title={x.tip ?? x.label}>
                        <x.icon className="h-4 w-4" /> {x.label}{x.disabled && <span className="ml-1 text-xs text-muted-foreground">(admin)</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="truncate text-muted-foreground" title={a.email}>{a.email}</span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                  <span>{a.phone || muted}</span><span>Joined {fmtDate(a.created_at)}</span><StatusChip status={a.status} />
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>{rows.length} accounts</span>
            <span className="flex items-center gap-2">
              <button disabled={page === 0} onClick={() => setPage(page - 1)} className={`${btnSm} disabled:opacity-30`} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
              {page + 1} / {pages}
              <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className={`${btnSm} disabled:opacity-30`} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
            </span>
          </div>
        </Card>
      )}
      <ViewDialog a={view} onClose={() => setView(null)} locked={view ? locked(view) : true} onDelete={() => view && setDel([target(view)])} />
      <EditDialog a={edit} onClose={() => setEdit(null)} onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "accounts"] })} />
      <DeleteAccountDialog targets={del} onClose={() => setDel(null)} onDeleted={onDeleted} />
    </div>
  );
}

function ViewDialog({ a, onClose, locked, onDelete }: { a: Acc | null; onClose: () => void; locked: boolean; onDelete: () => void }) {
  const saved = useQuery({
    queryKey: ["admin", "saved", a?.id], enabled: !!a,
    queryFn: async () => (await supabase.from("saved_projects").select("created_at, projects(name)").eq("user_id", a!.id)).data ?? [],
  });
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{a?.full_name || a?.email}</DialogTitle></DialogHeader>
        {a && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted-foreground">Email</dt><dd className="break-all text-navy">{a.email}</dd></div>
            <div><dt className="text-muted-foreground">Phone</dt><dd className="text-navy">{a.phone || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Joined</dt><dd className="text-navy">{fmtDate(a.created_at)}</dd></div>
            <div><dt className="text-muted-foreground">Type</dt><dd className="text-navy">{a.account_type}</dd></div>
          </dl>
        )}
        <h3 className="mt-2 font-semibold text-navy">Saved projects</h3>
        {saved.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !saved.data?.length ? <p className="text-sm text-muted-foreground">None.</p> : (
          <ul className="list-disc pl-5 text-sm text-navy">{saved.data.map((s, i) => <li key={i}>{(s.projects as { name: string } | null)?.name}</li>)}</ul>
        )}
        <div className="mt-4 rounded-xl border border-brand-red/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-red">Danger zone</p>
          <span title={locked ? ADMIN_LOCK_TIP : undefined} className="mt-2 inline-flex">
            <button onClick={onDelete} disabled={locked} className={`${btnDanger} disabled:cursor-not-allowed disabled:opacity-40`}><Trash2 className="h-4 w-4" /> Delete account</button>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ a, onClose, onSaved }: { a: Acc | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!a) return;
    setName(a.full_name ?? ""); setPhone(a.phone ?? "");
    // load the latest saved values in case the list is out of date
    supabase.from("profiles").select("full_name, phone").eq("id", a.id).maybeSingle().then(({ data }) => { if (data) { setName(data.full_name ?? ""); setPhone(data.phone ?? ""); } });
  }, [a]);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const p = phone.trim() ? normalizeBdPhone(phone.trim()) : "";
    if (p === null) return void toast.error("Enter a valid Bangladesh mobile number.");
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: name.trim(), phone: p }).eq("id", a!.id);
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Saved"); onSaved(); onClose();
  }
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit account</DialogTitle></DialogHeader>
        {a && (
          <form onSubmit={save} className="space-y-3">
            <p className="break-all text-sm text-muted-foreground">{a.email}</p>
            <label className="block text-sm font-medium text-navy">Full name<input value={name} onChange={(e) => setName(e.target.value)} className="admin-input mt-1" /></label>
            <label className="block text-sm font-medium text-navy">Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="admin-input mt-1" /></label>
            <button disabled={busy} className="btn btn-primary disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Clients() {
  const qc = useQueryClient();
  const admins = useAdminEmails();
  const [del, setDel] = useState<DeleteTarget[] | null>(null);
  const [delLogin, setDelLogin] = useState<LoginTarget[] | null>(null);
  const q = useQuery({
    queryKey: ["admin", "clients"],
    queryFn: async () => {
      const [c, b, p, u] = await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase.from("client_balances").select("*"),
        supabase.from("projects").select("id, name").order("sort_order"),
        supabase.from("profiles").select("id, username").eq("account_type", "client"),
      ]);
      if (c.error) throw c.error;
      return { clients: c.data ?? [], balances: b.data ?? [], projects: p.data ?? [], users: u.data ?? [] };
    },
  });
  const [term, setTerm] = useState(""); const [proj, setProj] = useState(""); const [status, setStatus] = useState(""); const [hideDemo, setHideDemo] = useState(true);
  const rows = useMemo(() => {
    if (!q.data) return [];
    const t = term.trim().toLowerCase();
    return q.data.clients
      .filter((c) => (!hideDemo || !c.is_demo) && (!t || [c.full_name, c.phone, c.email, c.flat_no].some((v) => v.toLowerCase().includes(t))) && (!proj || c.project_id === proj) && (!status || c.status === status))
      .map((c) => ({ c, b: q.data.balances.find((x) => x.client_id === c.id), p: q.data.projects.find((x) => x.id === c.project_id) }));
  }, [q.data, term, proj, status, hideDemo]);
  // demo clients never count towards business totals
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.filter((r) => !r.c.is_demo).reduce((s, r) => s + f(r), 0);
  const totals = [["Total sales value", sum((r) => Number(r.c.total_price))], ["Total collected", sum((r) => Number(r.b?.total_paid ?? 0))], ["Total due", sum((r) => Number(r.b?.amount_due ?? r.c.total_price))], ["Overdue", sum((r) => Number(r.b?.overdue_amount ?? 0))]] as const;

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {totals.map(([k, v]) => <Card key={k}><p className="text-xs uppercase tracking-wider text-muted-foreground">{k}</p><p className={`mt-1 font-display text-xl ${k === "Overdue" && v > 0 ? "text-brand-red" : "text-navy"}`}>{taka(v)}</p></Card>)}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <label className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search name, phone, flat" aria-label="Search clients" className="admin-input !pl-9" /></label>
        <select value={proj} onChange={(e) => setProj(e.target.value)} aria-label="Project" className="admin-input !w-auto"><option value="">All projects</option>{q.data?.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className="admin-input !w-auto"><option value="">All statuses</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>
        <label className="inline-flex items-center gap-2 text-sm text-navy"><input type="checkbox" checked={hideDemo} onChange={(e) => setHideDemo(e.target.checked)} /> Hide demo clients</label>
      </div>
      {q.isLoading ? <ListSkeleton /> : !rows.length ? <Empty title="No clients yet"><Link to="/admin/accounts/new" search={{}} className="btn btn-primary !py-2"><Plus className="h-4 w-4" /> Add client</Link></Empty> : (
        <Card className="!p-0 overflow-hidden">
          <div className="hidden grid-cols-[1.4fr_1fr_1.2fr_70px_1fr_1fr_1fr_110px_200px] gap-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:grid">
            <span>Name</span><span>Phone</span><span>Project</span><span>Flat</span><span>Total</span><span>Paid</span><span>Due</span><span>Next due</span><span className="text-right">Actions</span>
          </div>
          <ul className="divide-y divide-border">
            {rows.map(({ c, b, p }) => {
              const overdue = Number(b?.overdue_amount ?? 0) > 0;
              return (
                <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-sm hover:bg-ivory lg:grid-cols-[1.4fr_1fr_1.2fr_70px_1fr_1fr_1fr_110px_200px]">
                  <Link to="/admin/accounts/$id" params={{ id: c.id }} className="grid min-w-0 gap-1 lg:col-span-8 lg:grid-cols-subgrid lg:items-center">
                    <span className="min-w-0 truncate font-semibold text-navy">{c.full_name}{c.is_demo && <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">DEMO</span>}{overdue && <span className="ml-2 rounded-full bg-brand-red px-2 py-0.5 text-[10px] text-white">Overdue</span>}{c.status !== "active" && <span className="ml-2 text-xs text-muted-foreground">({c.status})</span>}
                      <span className="block truncate text-xs font-normal text-muted-foreground">{c.profile_id ? `@${q.data?.users.find((x) => x.id === c.profile_id)?.username ?? "login"}` : "No login"}</span></span>
                    <span className="text-muted-foreground">{c.phone || muted}</span>
                    <span className="truncate text-muted-foreground">{p?.name ?? muted}</span>
                    <span className="text-muted-foreground">{c.flat_no || muted}</span>
                    <span className="text-navy">{taka(c.total_price)}</span>
                    <span className="text-navy">{taka(b?.total_paid ?? 0)}</span>
                    <span className="text-navy">{taka(b?.amount_due ?? c.total_price)}</span>
                    <span className={overdue ? "font-semibold text-brand-red" : "text-muted-foreground"}>{b?.next_due_date ? fmtDate(b.next_due_date) : muted}</span>
                  </Link>
                  <span className="flex flex-nowrap justify-end gap-1.5 self-start lg:self-center">
                    <Link to="/admin/accounts/clients/$id/edit" params={{ id: c.id }} title="Edit" aria-label={`Edit ${c.full_name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-navy/20 text-navy hover:bg-navy/5"><Pencil className="h-4 w-4" /></Link>
                    <Link to="/admin/accounts/$id" params={{ id: c.id }} title="View" aria-label={`View ${c.full_name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-navy/20 text-navy hover:bg-navy/5"><Eye className="h-4 w-4" /></Link>
                    {(() => { const lock = admins.has(c.email.toLowerCase()); return (<>
                      {c.profile_id && !lock && <Link to="/admin/accounts/create-logins" search={{ reset: c.id }} title="Reset login" aria-label={`Reset login for ${c.full_name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-navy/20 text-navy hover:bg-navy/5"><KeyRound className="h-4 w-4" /></Link>}
                      {c.profile_id && !lock && <IconBtn label={`Delete login for ${c.full_name}`} title="Delete login (keeps client record)" danger onClick={() => setDelLogin([{ clientId: c.id, name: c.full_name }])}><UserX className="h-4 w-4" /></IconBtn>}
                      <IconBtn label={`Delete ${c.full_name}`} title={lock ? ADMIN_LOCK_TIP : "Delete"} danger disabled={lock} onClick={() => setDel([{ profileId: c.profile_id, clientId: c.id, name: c.full_name, email: c.email || c.phone, isClient: true }])}><Trash2 className="h-4 w-4" /></IconBtn>
                    </>); })()}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <DeleteAccountDialog targets={del} onClose={() => setDel(null)} onDeleted={() => qc.invalidateQueries({ queryKey: ["admin", "clients"] })} />
      <DeleteLoginsDialog targets={delLogin} onClose={() => setDelLogin(null)} onDone={() => qc.invalidateQueries({ queryKey: ["admin"] })} />
    </div>
  );
}
