import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, History, List, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { deleteAccount } from "@/lib/admin-accounts.functions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/admin/ui";

export type DeleteTarget = { profileId: string | null; clientId: string | null; name: string; email: string; isClient: boolean };

/** Lower-cased emails of all admins (only returned to admins). */
export function useAdminEmails() {
  const q = useQuery({
    queryKey: ["admin", "admin-emails"],
    queryFn: async () => { const { data } = await supabase.rpc("admin_emails"); return new Set((data ?? []).map((e: string) => e.toLowerCase())); },
    staleTime: 5 * 60_000,
  });
  return q.data ?? new Set<string>();
}

export async function logAudit(action: string, targetEmail: string, details: Record<string, unknown> = {}) {
  const { data } = await supabase.auth.getUser();
  await supabase.from("admin_audit_log").insert({ admin_email: data.user?.email ?? "", action, target_email: targetEmail, details: details as never });
}

export const ADMIN_LOCK_TIP = "Admin accounts can't be deleted here";

export const muted = <span className="text-muted-foreground/60">—</span>;

export function StatusChip({ status }: { status: string }) {
  const s = status === "suspended";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${s ? "bg-brand-red/10 text-brand-red" : "bg-ok/10 text-ok"}`}>{status}</span>;
}

/** Square icon button with a native tooltip. */
export function IconBtn({ label, onClick, danger, disabled, children, title, compact }: { compact?: boolean; label: string; onClick?: () => void; danger?: boolean; disabled?: boolean; children: ReactNode; title?: string }) {
  return (
    <span title={title ?? label} className="inline-flex">
      <button type="button" onClick={onClick} disabled={disabled} aria-label={label}
        className={`inline-flex ${compact ? "h-7 w-7" : "h-8 w-8"} shrink-0 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-35 ${danger ? "border-brand-red/30 text-brand-red hover:bg-brand-red/5" : "border-navy/20 text-navy hover:bg-navy/5"}`}>
        {children}
      </button>
    </span>
  );
}

export function DeleteAccountDialog({ targets, onClose, onDeleted }: { targets: DeleteTarget[] | null; onClose: () => void; onDeleted: (t: DeleteTarget[]) => void }) {
  const run = useServerFn(deleteAccount);
  const qc = useQueryClient();
  const [typed, setTyped] = useState("");
  const [mode, setMode] = useState<"login" | "all">("login");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setTyped(""); setMode("login"); setBusy(false); }, [targets]);
  if (!targets) return null;
  const bulk = targets.length > 1;
  const one = targets[0];
  const word = bulk ? "DELETE" : one?.email ?? "";
  const ok = !!word && typed.trim().toLowerCase() === word.toLowerCase();
  const anyClient = targets.some((t) => t.isClient);
  const loginOnlyImpossible = !bulk && !!one && !one.profileId;
  const effMode = loginOnlyImpossible ? "all" : mode;

  async function go() {
    if (!ok || !targets) return;
    setBusy(true);
    const done: DeleteTarget[] = [];
    for (const t of targets) {
      try {
        await run({ data: { profileId: t.profileId, clientId: effMode === "all" ? t.clientId : null, mode: effMode } });
        done.push(t);
      } catch (e) {
        toast.error(`${t.email || t.name}: ${e instanceof Error ? e.message : "Delete failed"}`);
      }
    }
    setBusy(false);
    if (done.length) {
      toast.success(done.length > 1 ? `${done.length} accounts deleted` : "Account deleted");
      onDeleted(done);
      qc.invalidateQueries({ queryKey: ["admin"] });
      onClose();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{bulk ? `Delete ${targets.length} accounts?` : "Delete this account?"}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm">
              {bulk ? (
                <ul className="max-h-32 overflow-y-auto rounded-lg bg-ivory p-3 text-navy">{targets.map((t) => <li key={t.profileId ?? t.clientId} className="truncate">{t.name || t.email} <span className="text-muted-foreground">· {t.email}</span></li>)}</ul>
              ) : (
                <p className="text-navy"><strong>{one?.name || "—"}</strong><br /><span className="break-all text-muted-foreground">{one?.email}</span></p>
              )}
              <p>This permanently deletes their login, profile and saved projects. They will be signed out and cannot sign in again with this account. This cannot be undone.</p>
            </div>
          </DialogDescription>
        </DialogHeader>

        {anyClient && !bulk && (
          <fieldset className="space-y-2 rounded-xl border border-border p-3 text-sm">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client record</legend>
            <label className={`flex gap-2 ${loginOnlyImpossible ? "opacity-40" : ""}`}>
              <input type="radio" name="mode" checked={effMode === "login"} disabled={loginOnlyImpossible} onChange={() => setMode("login")} className="mt-1" />
              <span className="text-navy">Delete the login only — keep the client record, payments, instalments and documents <span className="text-muted-foreground">(recommended)</span>{loginOnlyImpossible && <span className="block text-xs text-muted-foreground">This client has no login.</span>}</span>
            </label>
            <label className={`flex gap-2 ${ok ? "" : "opacity-40"}`}>
              <input type="radio" name="mode" checked={effMode === "all"} disabled={!ok} onChange={() => setMode("all")} className="mt-1" />
              <span className="text-navy">Also delete the client record and all its payments, instalments and documents</span>
            </label>
            {effMode === "all" && <p className="flex items-start gap-2 rounded-lg bg-brand-red/10 p-2 text-brand-red"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Financial records will be lost permanently.</p>}
            {!ok && !loginOnlyImpossible && <p className="text-xs text-muted-foreground">Type the email below to enable the second option.</p>}
          </fieldset>
        )}
        {bulk && anyClient && <p className="text-xs text-muted-foreground">Client records, payments and documents are kept; only the logins are deleted.</p>}

        <label className="block text-sm text-navy">
          Type <strong className="break-all">{word}</strong> to confirm
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} className="admin-input mt-1" aria-label="Confirmation" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn border border-navy/30 !py-2 text-navy">Cancel</button>
          <button type="button" onClick={go} disabled={!ok || busy} className="btn btn-primary !py-2 disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete permanently
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ACTION_LABEL: Record<string, string> = {
  update_client: "Updated client", update_login_email: "Changed login email", delete_account: "Deleted account", suspend: "Suspended",
  reactivate: "Reactivated", make_client: "Made client", import_clients: "Imported from Excel", create_login: "Created login",
  reset_login: "Reset login", reset_password: "Reset password", delete_login: "Deleted login", link_login: "Linked login",
};
type AuditRow = { id: string; created_at: string; action: string; target_email: string | null; admin_email: string; details: unknown };
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

function ActivityRow({ e }: { e: AuditRow }) {
  const d = e.details as { mode?: string; file?: string; updated?: string[] } | null;
  const target = e.target_email || (d?.file ? `${d.file}${d.updated?.length ? ` · ${d.updated.length} flat${d.updated.length === 1 ? "" : "s"}` : ""}` : "");
  return (
    <li className="grid gap-0.5 py-2.5 sm:grid-cols-[150px_minmax(0,1fr)_minmax(0,220px)] sm:gap-3">
      <span className="text-xs text-muted-foreground sm:text-sm">{when(e.created_at)}</span>
      <span className="min-w-0 text-navy"><strong>{ACTION_LABEL[e.action] ?? e.action}</strong>{target && <span className="ml-1 [overflow-wrap:anywhere] text-muted-foreground">{target}</span>}{d?.mode === "all" && <span className="ml-1 text-xs text-brand-red">(incl. client record)</span>}</span>
      <span className="truncate text-xs text-muted-foreground sm:text-sm" title={e.admin_email}>by {e.admin_email}</span>
    </li>
  );
}

/** Admin activity: a small collapsed panel; "All activities" opens the full log in a pop-up. */
export function ActivityList() {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const [filter, setFilter] = useState("");
  const recent = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: async () => { const { data, error } = await supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(5); if (error) throw error; return (data ?? []) as AuditRow[]; },
  });
  const full = useQuery({
    queryKey: ["admin", "audit", "all"],
    enabled: all,
    queryFn: async () => { const { data, error } = await supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(500); if (error) throw error; return (data ?? []) as AuditRow[]; },
  });
  const f = filter.trim().toLowerCase();
  const rows = (full.data ?? []).filter((e) => !f || [ACTION_LABEL[e.action] ?? e.action, e.target_email ?? "", e.admin_email, JSON.stringify(e.details ?? "")].join(" ").toLowerCase().includes(f));
  const latest = recent.data?.[0];
  return (
    <Card className="mt-8 !p-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <History className="h-4 w-4 shrink-0 text-brand-red" />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg text-navy">Activities</span>
          {latest && !open && <span className="block truncate text-xs text-muted-foreground">Last: {ACTION_LABEL[latest.action] ?? latest.action} · {when(latest.created_at)}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-navy transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border px-5 pb-4">
          {recent.isLoading ? <p className="py-3 text-sm text-muted-foreground">Loading…</p> : !recent.data?.length ? <p className="py-3 text-sm text-muted-foreground">No activity yet.</p> : (
            <ul className="divide-y divide-border text-sm">{recent.data.slice(0, 3).map((e) => <ActivityRow key={e.id} e={e} />)}</ul>
          )}
          <button type="button" onClick={() => setAll(true)} className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-navy/20 px-3.5 py-2 text-xs font-semibold text-navy transition hover:bg-navy/5">
            <List className="h-3.5 w-3.5" /> All activities
          </button>
        </div>
      )}
      <Dialog open={all} onOpenChange={setAll}>
        <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl flex-col">
          <DialogHeader><DialogTitle>All activities</DialogTitle><DialogDescription>Every admin change, newest first.</DialogDescription></DialogHeader>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search by action, email, flat or file…" className="admin-input" aria-label="Search activities" />
          <div data-lenis-prevent className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
            {full.isLoading ? <p className="py-4 text-sm text-muted-foreground">Loading…</p> : !rows.length ? <p className="py-4 text-sm text-muted-foreground">Nothing found.</p> : (
              <ul className="divide-y divide-border text-sm">{rows.map((e) => <ActivityRow key={e.id} e={e} />)}</ul>
            )}
          </div>
          {full.data && <p className="text-xs text-muted-foreground">{rows.length} of {full.data.length} shown</p>}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
