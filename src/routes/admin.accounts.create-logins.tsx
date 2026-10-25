import { downloadText } from "@/lib/download";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Copy, Download, KeyRound, Link2, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, Empty, ListSkeleton, PageTitle, btnDanger, btnSm } from "@/components/admin/ui";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BatchProgress, DeleteLoginsDialog, PASSWORD_WARNING, ShareCard, copyText, type LoginTarget } from "@/components/admin/PortalLogins";
import { useAdminEmails } from "@/components/admin/AccountAdmin";
import { createPortalLogins, linkClientToProfile, resetPortalLogin } from "@/lib/portal-logins.functions";
import { loginsCsv, normPhone, proposeUsernames, shareMessage, tempPassword, validUsername } from "@/lib/portal-logins";
import { fmtDate } from "@/lib/account";

type Tab = "without" | "with" | "all";
export const Route = createFileRoute("/admin/accounts/create-logins")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab; reset?: string } => {
    const o: { tab?: Tab; reset?: string } = {};
    if (s["tab"] === "with" || s["tab"] === "all") o.tab = s["tab"];
    if (typeof s["reset"] === "string") o.reset = s["reset"];
    return o;
  },
  component: CreateLogins,
});

type Row = { username: string; password: string };
type Client = { id: string; full_name: string; phone: string; flat_no: string; email: string; project_id: string | null; profile_id: string | null };
type Prof = { id: string; username: string | null; phone: string; must_change_password: boolean; last_seen_at: string | null; email: string };
type Outcome = { clientId: string; ok: boolean; username?: string; password?: string; reason?: string; profileId?: string | null; recreated?: boolean };

function CreateLogins() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const tab: Tab = search.tab ?? "without";
  const admins = useAdminEmails();
  const create = useServerFn(createPortalLogins);
  const reset = useServerFn(resetPortalLogin);
  const link = useServerFn(linkClientToProfile);
  const q = useQuery({
    queryKey: ["admin", "create-logins"],
    queryFn: async () => {
      const [c, p, pr] = await Promise.all([
        supabase.from("clients").select("id, full_name, phone, flat_no, email, project_id, profile_id").order("flat_no"),
        supabase.from("profiles").select("id, username, phone, must_change_password, last_seen_at, email"),
        supabase.from("projects").select("id, name").order("sort_order"),
      ]);
      if (c.error) throw c.error;
      const profs = (p.data ?? []) as Prof[];
      return { clients: (c.data ?? []) as Client[], profs: new Map(profs.map((x) => [x.id, x])), taken: new Set(profs.map((x) => x.username ?? "").filter(Boolean)), phones: new Set(profs.map((x) => x.phone).filter(Boolean)), projects: pr.data ?? [] };
    },
  });
  const [proj, setProj] = useState(""); const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"list" | "create" | "reset">("list");
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [shared, setShared] = useState(false); const [sharedPw, setSharedPw] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number; log: { name: string; ok: boolean; msg: string }[] } | null>(null);
  const [results, setResults] = useState<Outcome[] | null>(null);
  const [del, setDel] = useState<LoginTarget[] | null>(null);

  const byId = (id: string) => q.data?.clients.find((c) => c.id === id);
  const prof = (c: Client) => (c.profile_id ? q.data?.profs.get(c.profile_id) : undefined);
  const isLocked = (c: Client) => admins.has(c.email.toLowerCase()) || admins.has((prof(c)?.email ?? "").toLowerCase());

  // "?reset=id1,id2" opens the reset editor directly (row actions elsewhere link here)
  useEffect(() => {
    if (!q.data || !search.reset) return;
    const ids = search.reset.split(",").filter((id) => { const c = byId(id); return c?.profile_id && !isLocked(c); });
    if (ids.length) openEditor("reset", ids);
    navigate({ to: "/admin/accounts/create-logins", search: { tab: "with" }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, search.reset, admins]);

  useEffect(() => {
    if (!results?.some((r) => r.ok)) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [results]);

  const list = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (q.data?.clients ?? []).filter((c) =>
      (tab === "all" || (tab === "with" ? !!c.profile_id : !c.profile_id)) && (!proj || c.project_id === proj) &&
      (!t || [c.full_name, c.flat_no, c.phone].some((v) => (v ?? "").toLowerCase().includes(t))));
  }, [q.data, proj, term, tab]);
  const selectable = list.filter((c) => !isLocked(c));
  const sel = list.filter((c) => picked.has(c.id));
  const selWith = sel.filter((c) => c.profile_id && !isLocked(c));
  const selWithout = sel.filter((c) => !c.profile_id);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function setTab(t: Tab) { setPicked(new Set()); navigate({ to: "/admin/accounts/create-logins", search: t === "without" ? {} : { tab: t } }); }

  function openEditor(m: "create" | "reset", ids: string[]) {
    if (!q.data) return;
    const cs = ids.map(byId).filter(Boolean) as Client[];
    const ownNames = new Set(cs.map((c) => prof(c)?.username ?? "").filter(Boolean));
    const taken = new Set([...q.data.taken].filter((u) => !ownNames.has(u)));
    const proposed = proposeUsernames(cs.filter((c) => !(m === "reset" && prof(c)?.username)), taken, q.data.phones);
    setRows(Object.fromEntries(cs.map((c) => [c.id, { username: (m === "reset" && prof(c)?.username) || proposed[c.id] || "", password: tempPassword() }])));
    setShared(false); setSharedPw(""); setMode(m);
  }

  const editorIds = Object.keys(rows);
  const statusOf = (id: string) => {
    const u = rows[id]?.username ?? "";
    if (!validUsername(u)) return "invalid";
    const c = byId(id); const own = c ? prof(c)?.username : undefined;
    if (u !== own && q.data?.taken.has(u)) return "taken";
    if (editorIds.some((k) => k !== id && rows[k]?.username === u)) return "taken";
    return "ok";
  };
  const blocked = editorIds.some((id) => statusOf(id) !== "ok") || (shared ? sharedPw.length < 8 : editorIds.some((id) => (rows[id]?.password ?? "").length < 8));
  const setRow = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id]!, ...patch } }));

  async function createOne(clientId: string, username: string, password: string): Promise<Outcome> {
    const { results } = await create({ data: { items: [{ clientId, username, password }] } });
    const r = results[0]!;
    return r.status === "created" ? { clientId, ok: true, username: r.username, password: r.password } : { clientId, ok: false, reason: r.reason, profileId: r.status === "exists" ? r.profileId : null };
  }

  async function submit() {
    const ids = editorIds; const out: Outcome[] = []; const log: { name: string; ok: boolean; msg: string }[] = [];
    setProgress({ done: 0, total: ids.length, log: [] });
    for (const id of ids) {
      const r = rows[id]!; const pw = shared ? sharedPw : r.password; const name = byId(id)?.full_name ?? "";
      let o: Outcome;
      try {
        if (mode === "reset") {
          const res = await reset({ data: { clientId: id, username: r.username, password: pw } });
          if (res.status === "reset") o = { clientId: id, ok: true, username: res.username, password: res.password };
          else if (res.status === "missing") { o = await createOne(id, r.username, pw); o.recreated = true; if (!o.ok) o.reason = `Login missing — create again: ${o.reason}`; }
          else o = { clientId: id, ok: false, reason: res.reason };
        } else o = await createOne(id, r.username, pw);
      } catch (e) { o = { clientId: id, ok: false, reason: e instanceof Error ? e.message : "Failed" }; }
      out.push(o); log.push({ name, ok: o.ok, msg: o.ok ? (o.recreated ? "Login missing — created again" : mode === "reset" ? "Reset" : "Created") : o.reason ?? "Failed" });
      setProgress({ done: out.length, total: ids.length, log: [...log] });
    }
    setProgress(null); setResults(out);
    const n = out.filter((r) => r.ok).length;
    toast.success(`${n} login${n === 1 ? "" : "s"} ${mode === "reset" ? "reset" : "created"}`);
    qc.invalidateQueries({ queryKey: ["admin"] });
  }

  async function linkExisting(clientId: string, profileId: string) {
    try {
      await link({ data: { clientId, profileId } });
      setResults((rs) => rs?.map((r) => (r.clientId === clientId ? { clientId, ok: false, reason: "Linked to the existing account" } : r)) ?? null);
      toast.success("Linked to the existing account");
      qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't link"); }
  }

  function finish() { setResults(null); setRows({}); setPicked(new Set()); setMode("list"); }

  if (results) {
    const ok = results.filter((r) => r.ok);
    const share = ok.map((r) => { const c = byId(r.clientId)!; return { id: r.clientId, flat: c.flat_no, name: c.full_name, phone: c.phone, username: r.username!, password: r.password! }; });
    const all = share.map((s) => shareMessage(s)).join("\n\n────────────\n\n");
    return (
      <div className="space-y-4">
        <PageTitle title={mode === "reset" ? "Logins reset" : "Logins created"} />
        {ok.length > 0 && <p role="alert" className="flex items-start gap-2 rounded-xl bg-brand-red/10 p-4 font-medium text-brand-red"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />{PASSWORD_WARNING} After leaving, passwords can't be viewed again — only reset.</p>}
        {ok.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => copyText(all)} className={btnSm}><Copy className="h-3.5 w-3.5" /> Copy all as text</button>
            <button onClick={() => downloadText(loginsCsv(share), "natec-client-logins.csv")} className={btnSm}><Download className="h-3.5 w-3.5" /> Download CSV</button>
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-2">{share.map((s) => <ShareCard key={s.id} {...s} />)}</div>
        {results.some((r) => !r.ok) && (
          <Card>
            <h2 className="!text-xl text-navy">Not done</h2>
            <ul className="mt-2 divide-y divide-border text-sm">
              {results.filter((r) => !r.ok).map((r) => { const c = byId(r.clientId); return (
                <li key={r.clientId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span><strong className="text-navy">{c?.full_name}</strong> {c?.flat_no && <span className="text-muted-foreground">· Flat {c.flat_no}</span>} — <span className="text-brand-red">{r.reason}</span></span>
                  {r.profileId && <button onClick={() => linkExisting(r.clientId, r.profileId!)} className={btnSm}><Link2 className="h-3.5 w-3.5" /> Link to existing account</button>}
                </li>
              ); })}
            </ul>
          </Card>
        )}
        <button onClick={() => { if (!ok.length || confirm("Passwords will not be shown again. Leave this page?")) finish(); }} className="btn btn-primary !py-2">Done</button>
      </div>
    );
  }

  if (mode !== "list") {
    const ids = editorIds;
    return (
      <div className="space-y-4">
        <button onClick={() => !progress && setMode("list")} className="inline-flex items-center gap-1 text-sm text-navy"><ArrowLeft className="h-4 w-4" /> Back to list</button>
        <PageTitle title={mode === "reset" ? `Reset ${ids.length} login${ids.length === 1 ? "" : "s"}` : `Create ${ids.length} login${ids.length === 1 ? "" : "s"}`} />
        <p className="text-sm text-muted-foreground">{mode === "reset" ? "Each client keeps their account, flat, payments and history. They get a new temporary password and are signed out everywhere. They can log in with it straight away; the dashboard suggests setting their own." : "Each gets a username and a temporary password they can log in with straight away; the dashboard suggests setting their own."}</p>
        <Card className="!p-0">
          <div className="hidden overflow-x-auto md:block" data-lenis-prevent>
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-3">Flat</th><th className="px-2 py-3">Name</th><th className="px-2 py-3">Phone</th><th className="px-2 py-3">Username</th><th className="px-2 py-3">Temporary password</th></tr></thead>
              <tbody className="divide-y divide-border">{ids.map((id) => <EditorRow key={id} c={byId(id)!} r={rows[id]!} st={statusOf(id)} shared={shared} sharedPw={sharedPw} set={(p) => setRow(id, p)} />)}</tbody>
            </table>
          </div>
          <ul className="divide-y divide-border md:hidden">{ids.map((id) => <EditorRow key={id} card c={byId(id)!} r={rows[id]!} st={statusOf(id)} shared={shared} sharedPw={sharedPw} set={(p) => setRow(id, p)} />)}</ul>
        </Card>
        <Card>
          <label className="flex items-center gap-2 text-sm font-medium text-navy"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Use one password for all</label>
          {shared && (
            <div className="mt-3 space-y-2">
              <input value={sharedPw} onChange={(e) => setSharedPw(e.target.value)} placeholder="At least 8 characters" aria-label="Password for all" className="admin-input max-w-xs font-mono" />
              <p className="flex items-start gap-2 text-sm text-brand-red"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Anyone who knows another client's phone number could open their account. Ask clients to set their own password after logging in.</p>
            </div>
          )}
        </Card>
        {progress ? <Card><BatchProgress {...progress} /></Card> : (
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={submit} disabled={!ids.length || blocked} className="btn btn-primary !py-2 disabled:opacity-50"><KeyRound className="h-4 w-4" /> {mode === "reset" ? "Reset" : "Create"} {ids.length} login{ids.length === 1 ? "" : "s"}</button>
            {blocked && <span className="text-sm text-brand-red">Fix the usernames/passwords marked in red first.</span>}
          </div>
        )}
      </div>
    );
  }

  const tabs: [Tab, string][] = [["without", "Without login"], ["with", "With login"], ["all", "All clients"]];
  const countOf = (t: Tab) => (q.data?.clients ?? []).filter((c) => t === "all" || (t === "with" ? !!c.profile_id : !c.profile_id)).length;
  return (
    <div className="space-y-4 pb-24">
      <Link to="/admin/accounts" search={{ tab: "clients" }} className="inline-flex items-center gap-1 text-sm text-navy"><ArrowLeft className="h-4 w-4" /> Clients</Link>
      <PageTitle title="Client logins" />
      <div role="tablist" className="flex w-fit flex-wrap gap-1 rounded-2xl border border-border bg-white p-1 text-sm">
        {tabs.map(([t, l]) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 font-medium ${tab === t ? "bg-navy text-white" : "text-navy hover:bg-navy/5"}`}>{l} <span className="opacity-70">({countOf(t)})</span></button>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search name, flat, phone" aria-label="Search clients" className="admin-input !pl-9" /></label>
        <select value={proj} onChange={(e) => setProj(e.target.value)} aria-label="Project" className="admin-input !w-auto"><option value="">All projects</option>{q.data?.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <button onClick={() => setPicked(new Set(selectable.map((c) => c.id)))} className={btnSm}>Select all</button>
        <button onClick={() => setPicked(new Set())} className={btnSm}>Select none</button>
      </div>
      {q.isLoading ? <ListSkeleton /> : !list.length ? <Empty title={tab === "without" ? "Every client already has a login" : "No clients here"} /> : (
        <Card className="!p-0">
          <div className="hidden overflow-x-auto md:block" data-lenis-prevent>
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-3 py-3 w-8"></th><th className="px-2 py-3">Flat</th><th className="px-2 py-3">Name</th><th className="px-2 py-3">Project</th><th className="px-2 py-3">Username</th><th className="px-2 py-3">Phone</th><th className="px-2 py-3">Last sign-in</th><th className="px-2 py-3">Changed password?</th><th className="px-2 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((c) => { const p = prof(c); const lock = isLocked(c); return (
                  <tr key={c.id} className={picked.has(c.id) ? "bg-ivory" : ""}>
                    <td className="px-3 py-2"><input type="checkbox" aria-label={`Select ${c.full_name}`} disabled={lock} title={lock ? "Admin accounts can't be changed here" : undefined} checked={picked.has(c.id)} onChange={() => toggle(c.id)} /></td>
                    <td className="px-2 py-2 text-navy">{c.flat_no || "—"}</td>
                    <td className="px-2 py-2 font-medium text-navy">{c.full_name}</td>
                    <td className="px-2 py-2 text-muted-foreground">{q.data?.projects.find((x) => x.id === c.project_id)?.name ?? "—"}</td>
                    <td className="px-2 py-2 font-mono text-xs text-navy">{c.profile_id ? (p?.username ?? "—") : <span className="font-sans text-muted-foreground">No login</span>}</td>
                    <td className="px-2 py-2 text-muted-foreground">{c.phone ? <>{c.phone}{!normPhone(c.phone) && <span className="block text-xs text-brand-red">invalid</span>}</> : "—"}</td>
                    <td className="px-2 py-2 text-muted-foreground">{p?.last_seen_at ? fmtDate(p.last_seen_at) : "—"}</td>
                    <td className="px-2 py-2">{c.profile_id ? (p && !p.must_change_password ? <span className="text-navy">Yes</span> : <span className="text-brand-red">Not yet</span>) : "—"}</td>
                    <td className="px-2 py-2 text-right"><RowActions c={c} lock={lock} onCreate={() => openEditor("create", [c.id])} onReset={() => openEditor("reset", [c.id])} onDelete={() => setDel([{ clientId: c.id, name: c.full_name }])} /></td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-border md:hidden">
            {list.map((c) => { const p = prof(c); const lock = isLocked(c); return (
              <li key={c.id} className={`flex items-start gap-3 px-4 py-3 text-sm ${picked.has(c.id) ? "bg-ivory" : ""}`}>
                <input type="checkbox" className="mt-1" aria-label={`Select ${c.full_name}`} disabled={lock} checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy">{c.full_name} <span className="text-xs font-normal text-muted-foreground">· Flat {c.flat_no || "—"}</span></p>
                  <p className="text-xs text-muted-foreground">{q.data?.projects.find((x) => x.id === c.project_id)?.name ?? "—"} · {c.phone || "No phone"}</p>
                  <p className="text-xs text-navy">{c.profile_id ? <><span className="font-mono">@{p?.username ?? "—"}</span> · Last sign-in {p?.last_seen_at ? fmtDate(p.last_seen_at) : "—"} · Changed password: {p && !p.must_change_password ? "Yes" : "Not yet"}</> : "No login"}</p>
                </div>
                <RowActions c={c} lock={lock} onCreate={() => openEditor("create", [c.id])} onReset={() => openEditor("reset", [c.id])} onDelete={() => setDel([{ clientId: c.id, name: c.full_name }])} />
              </li>
            ); })}
          </ul>
        </Card>
      )}
      {sel.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-4 py-3 shadow-lg backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
            <span className="mr-auto text-sm text-navy">{sel.length} selected</span>
            {selWithout.length > 0 && <button onClick={() => openEditor("create", selWithout.map((c) => c.id))} className="btn btn-primary !py-2"><KeyRound className="h-4 w-4" /> Create logins ({selWithout.length})</button>}
            {selWith.length > 0 && <button onClick={() => openEditor("reset", selWith.map((c) => c.id))} className={btnSm}><KeyRound className="h-4 w-4" /> Reset logins ({selWith.length})</button>}
            {selWith.length > 0 && <button onClick={() => setDel(selWith.map((c) => ({ clientId: c.id, name: c.full_name })))} className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-3 py-1.5 text-xs font-medium text-white"><Trash2 className="h-4 w-4" /> Delete logins ({selWith.length})</button>}
          </div>
        </div>
      )}
      <DeleteLoginsDialog targets={del} onClose={() => setDel(null)} onDone={() => { setPicked(new Set()); qc.invalidateQueries({ queryKey: ["admin"] }); }} />
    </div>
  );
}

function RowActions({ c, lock, onCreate, onReset, onDelete }: { c: Client; lock: boolean; onCreate: () => void; onReset: () => void; onDelete: () => void }) {
  if (lock) return <span className="text-xs text-muted-foreground">Admin</span>;
  if (!c.profile_id) return <button onClick={onCreate} className={btnSm}><KeyRound className="h-3.5 w-3.5" /> Create</button>;
  return (
    <>
      <span className="hidden justify-end gap-1.5 md:inline-flex">
        <button onClick={onReset} title="Reset login" aria-label={`Reset login for ${c.full_name}`} className={btnSm}><KeyRound className="h-4 w-4" /></button>
        <button onClick={onDelete} title="Delete login" aria-label={`Delete login for ${c.full_name}`} className={btnDanger}><Trash2 className="h-4 w-4" /></button>
      </span>
      <span className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={`Actions for ${c.full_name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-navy/20 text-navy"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onReset}><KeyRound className="h-4 w-4" /> Reset login</DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-brand-red"><Trash2 className="h-4 w-4" /> Delete login</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </>
  );
}

function EditorRow({ c, r, st, shared, sharedPw, set, card }: { c: Client; r: Row; st: string; shared: boolean; sharedPw: string; set: (p: Partial<Row>) => void; card?: boolean }) {
  const user = (
    <>
      <input value={r.username} onChange={(e) => set({ username: e.target.value.toLowerCase().replace(/\s/g, "") })} aria-label={`Username for ${c.full_name}`} className="admin-input !py-1.5 font-mono" />
      <span className={`text-xs ${st === "ok" ? "text-navy/70" : "text-brand-red"}`} aria-live="polite">{st === "ok" ? "✓ Available" : st === "taken" ? "Taken" : "3–30: a–z, 0–9, . or _"}</span>
    </>
  );
  const pw = <input value={shared ? sharedPw : r.password} disabled={shared} onChange={(e) => set({ password: e.target.value })} aria-label={`Password for ${c.full_name}`} className="admin-input !py-1.5 font-mono disabled:opacity-50" />;
  if (card) return (
    <li className="space-y-2 px-4 py-3 text-sm">
      <p className="font-semibold text-navy">{c.full_name} <span className="text-xs font-normal text-muted-foreground">· Flat {c.flat_no || "—"} · {c.phone || "No phone"}</span></p>
      <div>{user}</div>{pw}
    </li>
  );
  return (
    <tr>
      <td className="px-3 py-2 text-navy">{c.flat_no || "—"}</td>
      <td className="px-2 py-2 font-medium text-navy">{c.full_name}</td>
      <td className="px-2 py-2 text-muted-foreground">{c.phone || "—"}</td>
      <td className="px-2 py-2">{user}</td>
      <td className="px-2 py-2">{pw}</td>
    </tr>
  );
}
