import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, PageTitle, btnSm } from "@/components/admin/ui";
import { fmtDate } from "@/lib/account";
import { taka } from "@/lib/money";
import { readXlsx } from "@/lib/xlsx-lite";
import { buildAgreementRows, parseScheduleWorkbook, type AgreementPlan, type ExistingRow } from "@/lib/schedule-import";

export const Route = createFileRoute("/admin/accounts/schedules")({ component: ImportSchedules });

type Result = { flat: string; ok: boolean; message: string };
const flatKey = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, "");

function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const o = e as { message?: string; details?: string; hint?: string; code?: string };
    return [o.message, o.details, o.hint].filter(Boolean).join(" — ") || (o.code ? `Database error ${o.code}` : "Unknown error");
  }
  return String(e);
}

/** Admin: update clients' payment schedules from the signed agreements (Excel, one row per payment). */
function ImportSchedules() {
  const qc = useQueryClient();
  const [fileName, setFileName] = useState("");
  const [plans, setPlans] = useState<AgreementPlan[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [projectId, setProjectId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  const projects = useQuery({ queryKey: ["admin", "project-names"], queryFn: async () => (await supabase.from("projects").select("id, name, kind").order("sort_order")).data ?? [] });
  const clients = useQuery({
    queryKey: ["admin", "schedule-import-clients", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("project_id", projectId);
      if (error) throw error;
      const ids = (data ?? []).map((c) => c.id);
      const inst = ids.length ? (await supabase.from("instalments").select("id, client_id, label, due_date, amount, paid_amount").in("client_id", ids)).data ?? [] : [];
      return (data ?? []).map((c) => ({
        client: c,
        rows: inst.filter((r) => r.client_id === c.id).map<ExistingRow>((r) => ({ id: r.id, label: r.label, due_date: r.due_date, amount: Number(r.amount), paid: Number(r.paid_amount) })),
      }));
    },
  });
  const byFlat = new Map((clients.data ?? []).map((x) => [flatKey(x.client.flat_no), x]));

  async function onFile(f: File | undefined) {
    if (!f) return;
    setResults([]);
    try {
      const r = parseScheduleWorkbook(await readXlsx(f));
      setFileName(f.name); setPlans(r.plans); setErrors(r.errors);
      setSelected(new Set(r.plans.filter((p) => !p.problems.length).map((p) => p.flat)));
      const name = r.plans.find((p) => p.project)?.project.toLowerCase();
      const match = name && (projects.data ?? []).find((p) => p.name.toLowerCase() === name);
      if (match && !projectId) setProjectId(match.id);
    } catch (e) { toast.error(`Could not read the file: ${errText(e)}`); }
  }

  const ready = (p: AgreementPlan) => !p.problems.length && byFlat.has(p.flat);
  const toggle = (f: string) => setSelected((s) => { const n = new Set(s); n.has(f) ? n.delete(f) : n.add(f); return n; });

  async function apply() {
    if (!plans) return;
    setBusy(true);
    const out: Result[] = [];
    for (const p of plans.filter((x) => selected.has(x.flat) && ready(x))) {
      const cur = byFlat.get(p.flat)!;
      const c = cur.client;
      try {
        const rows = buildAgreementRows(p, cur.rows, c.booking_date);
        const oldTotal = cur.rows.reduce((s, r) => s + r.amount, 0);
        const client = {
          full_name: c.full_name, phone: c.phone, email: c.email, address: c.address, status: c.status,
          profile_id: c.profile_id, project_id: c.project_id, flat_no: c.flat_no, floor: c.floor, size_sft: c.size_sft,
          parking: c.parking || p.rows.some((r) => r.item === "Car parking"), booking_date: c.booking_date,
          agreement_date: p.agreementDate ?? c.agreement_date, total_price: p.total,
        };
        const changes = {
          source: { old: null, new: `Agreement schedule import (${fileName})` },
          total_price: { old: Number(c.total_price), new: p.total },
          schedule: { old: { rows: cur.rows.length, total: oldTotal }, new: { rows: rows.length, total: p.total, ends: rows.at(-1)?.due_date ?? null } },
          ...(p.agreementDate && p.agreementDate !== c.agreement_date ? { agreement_date: { old: c.agreement_date, new: p.agreementDate } } : {}),
        };
        const { error } = await supabase.rpc("admin_save_client", {
          _client_id: c.id, _client: client as never,
          _rows: rows.map((r) => ({ id: r.id ?? "", due_date: r.due_date, amount: Number(r.amount), label: r.label })) as never,
          _notes: null as never, _changes: changes as never,
        });
        if (error) throw error;
        const re = await supabase.rpc("admin_reallocate_payments", { _client_id: c.id });
        if (re.error) throw re.error;
        const inst = rows.filter((r) => r.label.startsWith("Instalment"));
        out.push({ flat: p.flat, ok: true, message: `${c.full_name} — ${taka(p.total)}, ${inst.length} instalments, ${fmtDate(inst[0]?.due_date ?? "")} → ${fmtDate(inst.at(-1)?.due_date ?? "")}` });
      } catch (e) { out.push({ flat: p.flat, ok: false, message: errText(e) }); }
    }
    setResults(out);
    setBusy(false);
    const ok = out.filter((r) => r.ok).length;
    if (ok) toast.success(`Updated ${ok} client${ok === 1 ? "" : "s"}`);
    if (out.some((r) => !r.ok)) toast.error("Some flats were not updated — see below.");
    await clients.refetch();
    qc.invalidateQueries({ queryKey: ["admin", "accounts"] }); qc.invalidateQueries({ queryKey: ["admin", "audit"] }); qc.invalidateQueries({ queryKey: ["account"] });
  }

  return (
    <div className="max-w-6xl">
      <Link to="/admin/accounts" search={{ tab: "clients" }} className="mb-3 inline-flex items-center gap-1 text-sm text-navy"><ArrowLeft className="h-4 w-4" /> Clients</Link>
      <PageTitle title="Update schedules from agreements" />

      <Card>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-navy/20 p-8 text-center hover:bg-navy/[0.03]">
          <CalendarClock className="h-8 w-8 text-navy" />
          <span className="font-semibold text-navy">{fileName || "Choose the agreement schedules file (.xlsx)"}</span>
          <span className="max-w-xl text-sm text-muted-foreground">One row per payment: Flat · Item (Booking money, Down payment, Instalment, Car parking) · No. · Amount · Due date. Booking money and down payment need no date — they are shown first, as paid up front. Flats with any missing instalment date are skipped until the date is filled in.</span>
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          <span className={btnSm}><Upload className="h-3.5 w-3.5" /> Select file</span>
        </label>
      </Card>

      {plans && (
        <>
          <Card className="mt-6">
            <label className="text-sm font-medium text-navy">Project on the website
              <select className="admin-input mt-1 max-w-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Choose…</option>
                {(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            {errors.length > 0 && <ul className="mt-4 space-y-1 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{errors.map((w) => <li key={w} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{w}</li>)}</ul>}
          </Card>

          <Card className="mt-6 overflow-x-auto">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="!text-xl text-navy">Flats in the file ({selected.size} selected)</h2>
              <button disabled={busy || !projectId || ![...selected].some((f) => { const p = plans.find((x) => x.flat === f); return p && ready(p); })} onClick={apply} className="btn btn-primary !py-2 disabled:opacity-50">{busy ? "Updating…" : "Update selected clients"}</button>
            </div>
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="py-2 pr-2" /><th>Flat</th><th>Client on website</th><th>Agreement</th><th>Instalments</th><th>New total</th><th>Current total</th><th>Status</th></tr></thead>
              <tbody>
                {plans.map((p) => {
                  const cur = byFlat.get(p.flat);
                  const inst = p.rows.filter((r) => r.item === "Instalment");
                  const curTotal = cur ? cur.rows.reduce((s, r) => s + r.amount, 0) : 0;
                  const ok = ready(p);
                  return (
                    <tr key={p.flat} className="border-b align-top last:border-0">
                      <td className="py-2 pr-2"><input type="checkbox" disabled={!ok} checked={ok && selected.has(p.flat)} onChange={() => toggle(p.flat)} aria-label={`Update ${p.flat}`} /></td>
                      <td className="py-2 font-semibold text-navy">{p.flat}</td>
                      <td className="py-2">{cur ? cur.client.full_name : <span className="text-brand-red">{projectId ? "No client with this flat" : "Choose the project"}</span>}</td>
                      <td className="py-2">{p.agreementDate ? fmtDate(p.agreementDate) : "—"}</td>
                      <td className="py-2">{inst.length}{inst[0]?.due ? <span className="block text-xs text-muted-foreground">{fmtDate(inst[0].due)} → {fmtDate(inst.at(-1)?.due ?? "")}</span> : null}</td>
                      <td className="py-2 font-semibold">{taka(p.total)}</td>
                      <td className={`py-2 ${cur && Math.abs(curTotal - p.total) > 0.5 ? "text-brand-red" : ""}`}>{cur ? taka(curTotal) : "—"}</td>
                      <td className="py-2">{p.problems.length ? <ul className="text-xs text-amber-800">{p.problems.map((x) => <li key={x}>{x}</li>)}</ul> : ok ? <span className="text-green-700">Ready</span> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">Payments already received stay as they are and are re-applied in order: booking money, down payment, then instalment 1, 2, 3… Every change is saved to the audit log.</p>
          </Card>
        </>
      )}

      {results.length > 0 && (
        <Card className="mt-6">
          <h2 className="!text-xl text-navy">Result</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {results.map((r) => <li key={r.flat} className={`flex gap-2 ${r.ok ? "text-navy" : "text-brand-red"}`}>{r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}<span><b>{r.flat}</b> — {r.message}</span></li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}
