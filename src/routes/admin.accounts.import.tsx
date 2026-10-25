import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/components/admin/AccountAdmin";
import { Card, PageTitle, btnSm } from "@/components/admin/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDate } from "@/lib/account";
import { taka } from "@/lib/money";
import { readXlsx } from "@/lib/xlsx-lite";
import { flatKey, parseClientWorkbook, type ClientEntry } from "@/lib/client-workbook";
import { buildAgreementRows } from "@/lib/schedule-import";

export const Route = createFileRoute("/admin/accounts/import")({ component: ImportClients });

type Result = { flat: string; ok: boolean; message: string };
type Current = { id: string; full_name: string; flat_no: string; booking_date: string | null; agreement_date: string | null; total_price: number; instTotal: number; instCount: number; paidTotal: number; payCount: number };

/** Supabase/PostgREST errors are plain objects, so `instanceof Error` misses them. */
function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const o = e as { message?: string; details?: string; hint?: string; code?: string };
    return [o.message, o.details, o.hint].filter(Boolean).join(" — ") || (o.code ? `Database error ${o.code}` : "Unknown error");
  }
  return String(e);
}
const csv = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/**
 * Admin: add and update client accounts from the "Natec clients" Excel (Clients · Schedule · Payments).
 * For each flat in the file, its schedule and payments are replaced by the file. Accounts and logins are never deleted.
 */
function ImportClients() {
  const qc = useQueryClient();
  const [fileName, setFileName] = useState("");
  const [entries, setEntries] = useState<ClientEntry[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [projectId, setProjectId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clearOthers, setClearOthers] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  const projects = useQuery({ queryKey: ["admin", "project-names"], queryFn: async () => (await supabase.from("projects").select("id, name, kind").order("sort_order")).data ?? [] });
  const current = useQuery({
    queryKey: ["admin", "import-current", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<Current[]> => {
      const { data, error } = await supabase.from("clients").select("id, full_name, flat_no, booking_date, agreement_date, total_price").eq("project_id", projectId);
      if (error) throw error;
      const ids = (data ?? []).map((c) => c.id);
      const [inst, pays] = ids.length
        ? await Promise.all([supabase.from("instalments").select("client_id, amount").in("client_id", ids), supabase.from("payments").select("client_id, amount").in("client_id", ids)])
        : [{ data: [] }, { data: [] }];
      return (data ?? []).map((c) => {
        const i = (inst.data ?? []).filter((x) => x.client_id === c.id), p = (pays.data ?? []).filter((x) => x.client_id === c.id);
        return { ...c, total_price: Number(c.total_price), instTotal: i.reduce((s, x) => s + Number(x.amount), 0), instCount: i.length, paidTotal: p.reduce((s, x) => s + Number(x.amount), 0), payCount: p.length };
      });
    },
  });
  const byFlat = new Map((current.data ?? []).map((c) => [flatKey(c.flat_no), c]));
  const inFile = new Set((entries ?? []).map((e) => e.flat));
  const others = (current.data ?? []).filter((c) => !inFile.has(flatKey(c.flat_no)) && (c.instCount || c.payCount || c.total_price));

  async function onFile(f: File | undefined) {
    if (!f) return;
    setResults([]);
    try {
      const r = parseClientWorkbook(await readXlsx(f));
      setFileName(f.name); setEntries(r.clients); setErrors(r.errors);
      setSelected(new Set(r.clients.filter((c) => !c.problems.length).map((c) => c.flat)));
      const name = r.clients.find((c) => c.project)?.project.toLowerCase();
      const match = name && (projects.data ?? []).find((p) => p.name.toLowerCase() === name);
      if (match) setProjectId(match.id);
    } catch (e) { toast.error(`Could not read the file: ${errText(e)}`); }
  }

  const problemsOf = (e: ClientEntry) => [...e.problems, ...(!byFlat.has(e.flat) && !e.info.full_name ? ["New flat: the client name is required."] : [])];
  const ready = (e: ClientEntry) => !!projectId && current.isSuccess && !problemsOf(e).length;
  const toggle = (f: string) => setSelected((s) => { const n = new Set(s); n.has(f) ? n.delete(f) : n.add(f); return n; });
  const chosen = (entries ?? []).filter((e) => selected.has(e.flat) && ready(e));

  async function backup() {
    const cur = current.data ?? [];
    const ids = cur.map((c) => c.id);
    if (!ids.length) { toast.message("No clients in this project yet."); return; }
    const [inst, pays] = await Promise.all([
      supabase.from("instalments").select("client_id, due_date, label, amount, paid_amount").in("client_id", ids).order("due_date"),
      supabase.from("payments").select("client_id, paid_on, type, amount, method, reference, note").in("client_id", ids).order("paid_on"),
    ]);
    const flat = new Map(cur.map((c) => [c.id, c]));
    const lines = [["Kind", "Flat", "Client", "Date", "Label / type", "Amount", "Paid", "Method", "Reference", "Note"].join(",")];
    for (const c of cur) lines.push(["Client", c.flat_no, c.full_name, c.booking_date ?? "", "Total price", c.total_price, "", "", "", ""].map(csv).join(","));
    for (const r of inst.data ?? []) lines.push(["Schedule", flat.get(r.client_id)?.flat_no, flat.get(r.client_id)?.full_name, r.due_date, r.label, r.amount, r.paid_amount, "", "", ""].map(csv).join(","));
    for (const r of pays.data ?? []) lines.push(["Payment", flat.get(r.client_id)?.flat_no, flat.get(r.client_id)?.full_name, r.paid_on, r.type, r.amount, "", r.method, r.reference, r.note].map(csv).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `natec-accounts-backup-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  async function wipe(clientId: string) {
    const p = await supabase.from("payments").delete().eq("client_id", clientId); if (p.error) throw p.error;
    const i = await supabase.from("instalments").delete().eq("client_id", clientId); if (i.error) throw i.error;
  }

  async function run() {
    setConfirm(false); setBusy(true);
    const out: Result[] = [];
    for (const e of chosen) {
      const cur = byFlat.get(e.flat);
      try {
        const info = e.info;
        const fields = {
          ...(info.full_name ? { full_name: info.full_name } : {}), ...(info.phone ? { phone: info.phone } : {}), ...(info.email ? { email: info.email } : {}),
          ...(info.address ? { address: info.address } : {}), ...(info.floor ? { floor: info.floor } : {}), ...(info.size_sft != null ? { size_sft: info.size_sft } : {}),
          ...(info.parking != null ? { parking: info.parking } : {}), ...(info.booking_date ? { booking_date: info.booking_date } : {}),
          ...(info.agreement_date ? { agreement_date: info.agreement_date } : {}), ...(info.notes ? { payment_plan_note: info.notes } : {}),
          total_price: info.total_price ?? (e.schedule ? e.schedule.total : 0),
        };
        let id = cur?.id;
        if (id) { const u = await supabase.from("clients").update(fields).eq("id", id); if (u.error) throw u.error; }
        else {
          const ins = await supabase.from("clients").insert({ full_name: info.full_name!, project_id: projectId, flat_no: e.flat, ...fields }).select("id").single();
          if (ins.error) throw ins.error; id = ins.data.id;
        }
        // Replace payments (always) and the schedule (when the file has one for this flat).
        const p = await supabase.from("payments").delete().eq("client_id", id); if (p.error) throw p.error;
        if (e.schedule) {
          const d = await supabase.from("instalments").delete().eq("client_id", id); if (d.error) throw d.error;
          const plan = { ...e.schedule, agreementDate: info.agreement_date ?? cur?.agreement_date ?? null };
          const rows = buildAgreementRows(plan, [], info.booking_date ?? cur?.booking_date ?? null);
          const r = await supabase.from("instalments").insert(rows.map((x) => ({ client_id: id!, due_date: x.due_date, amount: x.amount, label: x.label }))); if (r.error) throw r.error;
        }
        if (e.payments.length) { const r = await supabase.from("payments").insert(e.payments.map((x) => ({ ...x, client_id: id! }))); if (r.error) throw r.error; }
        const re = await supabase.rpc("admin_reallocate_payments", { _client_id: id }); if (re.error) throw re.error;
        const paid = e.payments.reduce((s, x) => s + x.amount, 0);
        out.push({ flat: e.flat, ok: true, message: `${cur ? "Updated" : "Created"} — ${info.full_name ?? cur?.full_name ?? ""}, total ${taka(fields.total_price)}, ${e.schedule ? `${e.schedule.rows.length} schedule rows` : "schedule unchanged"}, ${e.payments.length} payments (${taka(paid)})` });
      } catch (err) { out.push({ flat: e.flat, ok: false, message: errText(err) }); }
    }
    if (clearOthers) {
      for (const c of others) {
        try {
          await wipe(c.id);
          const u = await supabase.from("clients").update({ total_price: 0 }).eq("id", c.id); if (u.error) throw u.error;
          out.push({ flat: c.flat_no, ok: true, message: `Cleared — ${c.full_name}: schedule and payments removed, account and login kept` });
        } catch (err) { out.push({ flat: c.flat_no, ok: false, message: `Not cleared: ${errText(err)}` }); }
      }
    }
    await logAudit("import_clients", "", { file: fileName, project: projects.data?.find((p) => p.id === projectId)?.name, updated: out.filter((r) => r.ok).map((r) => r.flat), failed: out.filter((r) => !r.ok).map((r) => r.flat), clearedOthers: clearOthers }).catch(() => undefined);
    setResults(out); setBusy(false);
    await current.refetch();
    qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["account"] });
    out.every((r) => r.ok) ? toast.success(`${out.length} flats done`) : toast.error("Some flats failed — see the list below");
    setTimeout(() => document.getElementById("import-result")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  return (
    <div className="max-w-6xl">
      <Link to="/admin/accounts" search={{ tab: "clients" }} className="mb-3 inline-flex items-center gap-1 text-sm text-navy"><ArrowLeft className="h-4 w-4" /> Clients</Link>
      <PageTitle title="Import clients from Excel" />

      <Card>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-navy/20 p-8 text-center hover:bg-navy/[0.03]">
          <FileSpreadsheet className="h-8 w-8 text-navy" />
          <span className="font-semibold text-navy">{fileName || "Choose the Natec clients file (.xlsx)"}</span>
          <span className="max-w-xl text-sm text-muted-foreground">Sheets: Clients · Schedule · Payments. New flats are added; existing flats are updated, and their schedule and payments are replaced by the file. Accounts and logins are never deleted. The file is read in your browser.</span>
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          <span className={btnSm}><Upload className="h-3.5 w-3.5" /> Select file</span>
        </label>
      </Card>

      {entries && (
        <>
          <Card className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <label className="text-sm font-medium text-navy">Project on the website
                <select className="admin-input mt-1 min-w-64" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">Choose…</option>
                  {(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              {projectId && <button onClick={backup} className={btnSm}><Download className="h-3.5 w-3.5" /> Download a backup of this project first</button>}
            </div>
            {errors.length > 0 && <ul className="mt-4 space-y-1 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{errors.map((w) => <li key={w} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{w}</li>)}</ul>}
          </Card>

          <Card className="mt-6 overflow-x-auto">
            <h2 className="mb-3 !text-xl text-navy">Flats in the file ({chosen.length} selected)</h2>
            <table className="w-full min-w-[860px] text-sm">
              <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="py-2 pr-2" /><th>Flat</th><th>Client</th><th>Action</th><th>Schedule (file)</th><th>Payments (file)</th><th>Now on the website</th><th>Check</th></tr></thead>
              <tbody>
                {entries.map((e) => {
                  const cur = byFlat.get(e.flat);
                  const inst = e.schedule?.rows.filter((r) => r.item === "Instalment") ?? [];
                  const probs = problemsOf(e);
                  const ok = ready(e);
                  return (
                    <tr key={e.flat} className="border-b align-top last:border-0">
                      <td className="py-2 pr-2"><input type="checkbox" disabled={!ok} checked={ok && selected.has(e.flat)} onChange={() => toggle(e.flat)} aria-label={`Import ${e.flat}`} /></td>
                      <td className="py-2 font-semibold text-navy">{e.flat}</td>
                      <td className="py-2">{e.info.full_name ?? cur?.full_name ?? "—"}{e.info.phone ? <span className="block text-xs text-muted-foreground">{e.info.phone}</span> : null}</td>
                      <td className="py-2">{!projectId ? "—" : cur ? "Update" : <span className="font-semibold text-green-700">New</span>}</td>
                      <td className="py-2">{e.schedule ? <>{taka(e.schedule.total)}<span className="block text-xs text-muted-foreground">{inst.length} instalments{inst[0]?.due ? ` · ${fmtDate(inst[0].due)} → ${fmtDate(inst.at(-1)?.due ?? "")}` : ""}</span></> : <span className="text-muted-foreground">not in file (kept)</span>}</td>
                      <td className="py-2">{e.payments.length} · {taka(e.payments.reduce((s, x) => s + x.amount, 0))}</td>
                      <td className="py-2 text-xs text-muted-foreground">{cur ? <>Plan {taka(cur.instTotal)} ({cur.instCount} rows)<br />Paid {taka(cur.paidTotal)} ({cur.payCount} payments)</> : "—"}</td>
                      <td className="py-2">{probs.length ? <ul className="text-xs text-amber-800">{probs.map((x) => <li key={x}>{x}</li>)}</ul> : ok ? <span className="text-green-700">Ready</span> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {projectId && others.length > 0 && (
              <label className="mt-5 flex items-start gap-2 rounded-xl bg-ivory p-4 text-sm text-navy">
                <input type="checkbox" className="mt-1" checked={clearOthers} onChange={(e) => setClearOthers(e.target.checked)} />
                <span>Also clear the {others.length} other clients in this project that are <b>not</b> in the file ({others.map((c) => c.flat_no).join(", ")}): remove their schedule and payments and set their total to ৳0. Their accounts and logins stay.</span>
              </label>
            )}
            <div className="mt-5 flex justify-end">
              <button disabled={busy || (!chosen.length && !(clearOthers && others.length))} onClick={() => setConfirm(true)} className="btn btn-primary !py-2 disabled:opacity-50">{busy ? "Working…" : "Import / update"}</button>
            </div>
          </Card>
        </>
      )}

      {results.length > 0 && (
        <Card className="mt-6"><div id="import-result" />
          <h2 className="!text-xl text-navy">Result</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {results.map((r) => <li key={r.flat} className={`flex gap-2 ${r.ok ? "text-navy" : "text-brand-red"}`}>{r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}<span><b>{r.flat}</b> — {r.message}</span></li>)}
          </ul>
        </Card>
      )}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Replace client data?</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            {chosen.length > 0 && <p><b className="text-navy">{chosen.length} flats</b> ({chosen.map((e) => e.flat).join(", ")}) will be created or updated. Their current schedule and payments are replaced by the file.</p>}
            {clearOthers && others.length > 0 && <p><b className="text-brand-red">{others.length} other clients</b> ({others.map((c) => c.flat_no).join(", ")}) will have their schedule and payments removed.</p>}
            <p>This cannot be undone. Download the backup first if you may need the old numbers.</p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setConfirm(false)} className={btnSm}>Cancel</button>
            <button onClick={run} className="btn btn-primary !py-2">Yes, replace</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
