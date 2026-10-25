import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WhatsAppIcon } from "@/components/SiteChrome";
import { Confirm, btnSm } from "@/components/admin/ui";
import { deletePortalLogin, resetPortalPassword } from "@/lib/portal-logins.functions";
import { shareMessage, waLink } from "@/lib/portal-logins";

export async function copyText(t: string) {
  try { await navigator.clipboard.writeText(t); toast.success("Copied"); } catch { toast.error("Couldn't copy — select the text and copy it manually."); }
}

export const PASSWORD_WARNING = "Passwords are shown only now. Copy or download them before leaving this page.";

/** One client's ready-to-send login message with Copy / WhatsApp buttons. */
export function ShareCard({ name, phone, flat, username, password }: { name: string; phone: string; flat: string; username: string; password: string }) {
  const msg = shareMessage({ name, username, password, flat });
  const wa = waLink(phone, msg);
  return (
    <div className="rounded-xl border border-border bg-ivory/50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-navy">{name}{flat && <span className="ml-2 text-xs font-normal text-muted-foreground">Flat {flat}</span>}</p>
        <p className="font-mono text-xs text-navy">{username} · {password}</p>
      </div>
      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 font-sans text-xs text-navy" data-lenis-prevent>{msg}</pre>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => copyText(msg)} className={btnSm}><Copy className="h-3.5 w-3.5" /> Copy message</button>
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={btnSm}><WhatsAppIcon /> Send on WhatsApp</a>}
      </div>
    </div>
  );
}

export function ResetPortalPassword({ clientId, name, phone, flat }: { clientId: string; name: string; phone: string; flat: string }) {
  const reset = useServerFn(resetPortalPassword);
  const [res, setRes] = useState<{ username: string; password: string } | null>(null);
  async function go() {
    try { setRes(await reset({ data: { clientId } })); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't reset the password"); }
  }
  return (
    <>
      <Confirm title="Reset portal password?" description={`${name} gets a new temporary password they can log in with; their dashboard then suggests setting their own. The old password stops working.`} confirmLabel="Reset password" onConfirm={go}>
        {(ask) => <button onClick={ask} className={btnSm}><KeyRound className="h-4 w-4" /> Reset portal password</button>}
      </Confirm>
      <Dialog open={!!res} onOpenChange={(o) => { if (!o) setRes(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New temporary password</DialogTitle></DialogHeader>
          <p role="alert" className="rounded-lg bg-brand-red/10 p-3 text-sm font-medium text-brand-red">{PASSWORD_WARNING}</p>
          {res && <ShareCard name={name} phone={phone} flat={flat} username={res.username} password={res.password} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

export type LoginTarget = { clientId: string; name: string };

/** Progress bar + per-client outcome list for one-by-one batch actions. */
export function BatchProgress({ done, total, log }: { done: number; total: number; log: { name: string; ok: boolean; msg: string }[] }) {
  return (
    <div className="space-y-2">
      <div className="h-2 overflow-hidden rounded-full bg-navy/10" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}><div className="h-full bg-navy transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
      <p className="text-xs text-muted-foreground">{done} / {total}</p>
      <ul className="max-h-48 space-y-1 overflow-auto text-sm" data-lenis-prevent>
        {log.map((l, i) => <li key={i} className={l.ok ? "text-navy" : "text-brand-red"}>{l.ok ? "✓" : "✕"} {l.name} — {l.msg}</li>)}
      </ul>
    </div>
  );
}

/** Type-DELETE confirmation; deletes each client's login one by one (client records stay). */
export function DeleteLoginsDialog({ targets, onClose, onDone }: { targets: LoginTarget[] | null; onClose: () => void; onDone: () => void }) {
  const del = useServerFn(deletePortalLogin);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ name: string; ok: boolean; msg: string }[] | null>(null);
  const n = targets?.length ?? 0;
  function close() { if (busy) return; setTyped(""); setLog(null); onClose(); }
  async function go() {
    if (!targets) return;
    setBusy(true); const out: { name: string; ok: boolean; msg: string }[] = []; setLog([]);
    for (const t of targets) {
      try { const r = await del({ data: { clientId: t.clientId } }); out.push({ name: t.name, ok: true, msg: r.note || "Login deleted" }); }
      catch (e) { out.push({ name: t.name, ok: false, msg: e instanceof Error ? e.message : "Failed" }); }
      setLog([...out]);
    }
    setBusy(false);
    const ok = out.filter((o) => o.ok).length;
    if (ok) toast.success(`${ok} login${ok === 1 ? "" : "s"} deleted`);
    onDone();
  }
  return (
    <Dialog open={!!targets} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Delete {n} client login{n === 1 ? "" : "s"}?</DialogTitle></DialogHeader>
        {log ? (
          <>
            <BatchProgress done={log.length} total={n} log={log} />
            {!busy && <button onClick={close} className="btn btn-primary !py-2">Close</button>}
          </>
        ) : (
          <>
            <p className="text-sm text-navy">They will be signed out and can no longer log in. Their client records, flats, instalments, payments and documents are <strong>KEPT</strong>.</p>
            {n <= 6 && <p className="text-xs text-muted-foreground">{targets?.map((t) => t.name).join(", ")}</p>}
            <label className="block text-sm font-medium text-navy">Type DELETE to confirm<input value={typed} onChange={(e) => setTyped(e.target.value)} className="admin-input mt-1 font-mono" autoComplete="off" /></label>
            <div className="flex justify-end gap-2">
              <button onClick={close} className={btnSm}>Cancel</button>
              <button onClick={go} disabled={typed !== "DELETE"} className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-4 py-2 text-sm font-medium text-white disabled:opacity-40"><Trash2 className="h-4 w-4" /> Delete {n} login{n === 1 ? "" : "s"}</button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
