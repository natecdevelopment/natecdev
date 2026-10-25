import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Banknote, Building2, CalendarClock, FileSpreadsheet, Film, HardHat, Image as ImageIcon, Inbox, Plus, Sparkles, Upload, UserPlus, Users, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, PageTitle } from "@/components/admin/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/account";
import { isExtra, lateFee, taka, todayIso } from "@/lib/money";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

const addDaysIso = (iso: string, d: number) => { const t = new Date(iso + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);

async function loadDashboard() {
  const head = (q: PromiseLike<{ count: number | null; error: unknown }>) => q;
  const [videos, current, upcoming, media, clientsR, balR, instR, payR, msgR, unreadR, projR] = await Promise.all([
    head(supabase.from("videos").select("id", { count: "exact", head: true })),
    head(supabase.from("projects").select("id", { count: "exact", head: true }).eq("kind", "current")),
    head(supabase.from("projects").select("id", { count: "exact", head: true }).eq("kind", "upcoming")),
    head(supabase.from("media").select("id", { count: "exact", head: true })),
    supabase.from("clients").select("id, full_name, flat_no, total_price, is_demo, profile_id"),
    supabase.from("client_balances").select("*"),
    supabase.from("instalments").select("id, client_id, label, due_date, amount, paid_amount"),
    supabase.from("payments").select("id, client_id, paid_on, amount, type, method, created_at").order("paid_on", { ascending: false }).order("created_at", { ascending: false }).limit(8),
    supabase.from("contact_submissions").select("id, full_name, subject, message, created_at, read_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("contact_submissions").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase.from("projects").select("id, name, kind, status, progress_pct, status_updated_at").eq("kind", "current").order("sort_order"),
  ]);
  const clients = (clientsR.data ?? []).filter((c) => !c.is_demo);
  const ids = new Set(clients.map((c) => c.id));
  const byId = new Map(clients.map((c) => [c.id, c]));
  const bal = (balR.data ?? []).filter((b) => b.client_id && ids.has(b.client_id));
  const inst = (instR.data ?? []).filter((r) => ids.has(r.client_id)).map((r) => ({ ...r, amount: Number(r.amount), paid_amount: Number(r.paid_amount) }));
  const today = todayIso();
  const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((s, x) => s + Number(x ?? 0), 0);

  const money = {
    sale: sum(clients.map((c) => c.total_price)),
    paid: sum(bal.map((b) => b.total_paid)),
    due: sum(bal.map((b) => b.amount_due)),
    overdue: sum(bal.map((b) => b.overdue_amount)),
    lateCollected: sum(bal.map((b) => b.late_fee_paid)),
    latePending: inst.reduce((s, r) => s + lateFee(r, today).fee, 0),
    clients: clients.length,
    logins: clients.filter((c) => c.profile_id).length,
  };
  const open = inst.filter((r) => r.paid_amount < r.amount && !isExtra(r.label));
  const soon = open.filter((r) => r.due_date >= today && r.due_date <= addDaysIso(today, 30)).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 7);
  // Overdue per client: oldest overdue date, amount, late fee.
  const od = new Map<string, { amount: number; since: string; fee: number }>();
  for (const r of open.filter((x) => x.due_date < today)) {
    const o = od.get(r.client_id) ?? { amount: 0, since: r.due_date, fee: 0 };
    o.amount += r.amount - r.paid_amount; if (r.due_date < o.since) o.since = r.due_date; o.fee += lateFee(r, today).fee;
    od.set(r.client_id, o);
  }
  const overdue = [...od.entries()].map(([id, o]) => ({ id, ...o })).sort((a, b) => a.since.localeCompare(b.since)).slice(0, 7);
  const payments = (payR.data ?? []).filter((p) => ids.has(p.client_id)).slice(0, 6);
  return {
    counts: { videos: videos.count ?? 0, current: current.count ?? 0, upcoming: upcoming.count ?? 0, media: media.count ?? 0 },
    money, soon, overdue, payments, byId, today,
    messages: msgR.data ?? [], unread: unreadR.count ?? 0,
    projects: projR.data ?? [],
  };
}

function greeting() {
  const h = new Date(Date.now() + 6 * 3600000).getUTCHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Dashboard() {
  const { data: d, isLoading } = useQuery({ queryKey: ["admin", "dashboard"], queryFn: loadDashboard });
  const pct = d && d.money.sale > 0 ? Math.min(100, (d.money.paid / d.money.sale) * 100) : 0;
  const tiles = [
    { label: "Videos", n: d?.counts.videos, icon: Film, to: "/admin/videos" },
    { label: "Current projects", n: d?.counts.current, icon: Building2, to: "/admin/projects" },
    { label: "Upcoming projects", n: d?.counts.upcoming, icon: Sparkles, to: "/admin/upcoming" },
    { label: "Media files", n: d?.counts.media, icon: ImageIcon, to: "/admin/media" },
  ] as const;
  const Empty = ({ t }: { t: string }) => <p className="py-6 text-center text-sm text-muted-foreground">{t}</p>;
  const Head = ({ icon: I, title, to, search, more = "View all" }: { icon: typeof Wallet; title: string; to?: string; search?: Record<string, string>; more?: string }) => (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 !text-lg text-navy"><I className="h-4 w-4 text-brand-red" />{title}</h2>
      {to && <Link to={to as "/admin"} search={search as never} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline">{more} <ArrowRight className="h-3.5 w-3.5" /></Link>}
    </div>
  );

  return (
    <>
      <PageTitle title="Dashboard">
        <p className="text-sm text-muted-foreground">{greeting()} · {d ? fmtDate(d.today) : ""}</p>
      </PageTitle>

      {/* Money overview */}
      <Card className="mb-6">
        <Head icon={Wallet} title="Client accounts" to="/admin/accounts" search={{ tab: "clients" }} more="Open accounts" />
        {isLoading || !d ? <Skeleton className="h-28 w-full" /> : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
              {[
                ["Total sale value", taka(d.money.sale), `${d.money.clients} clients · ${d.money.logins} with login`, false],
                ["Collected", taka(d.money.paid), `${pct.toFixed(1)}% of sale value`, false],
                ["Still to collect", taka(d.money.due), "Across all schedules", false],
                ["Overdue", taka(d.money.overdue), d.overdue.length ? `${d.overdue.length} client${d.overdue.length === 1 ? "" : "s"} behind` : "Nobody is behind", d.money.overdue > 0],
                ["Late fees", taka(d.money.latePending), `Pending · ${taka(d.money.lateCollected)} collected`, d.money.latePending > 0],
              ].map(([k, v, sub, red]) => (
                <div key={String(k)} className={`min-w-0 rounded-xl p-3 sm:p-4 ${k === "Total sale value" ? "col-span-2 lg:col-span-1" : ""} ${red ? "bg-brand-red/5 ring-1 ring-brand-red/20" : "bg-ivory"}`}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">{k}</p>
                  <p className={`num mt-1.5 whitespace-nowrap text-lg sm:text-xl md:text-2xl ${red ? "text-brand-red" : "text-navy"}`}>{v}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-navy/10" aria-label={`Collected ${pct.toFixed(1)}%`}><div className="h-full rounded-full bg-brand-red transition-all" style={{ width: `${pct}%` }} /></div>
          </>
        )}
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
        <Card>
          <Head icon={CalendarClock} title="Due in the next 30 days" />
          {isLoading || !d ? <Skeleton className="h-40 w-full" /> : !d.soon.length ? <Empty t="No instalments due in the next 30 days." /> : (
            <ul className="divide-y divide-border">
              {d.soon.map((r) => { const c = d.byId.get(r.client_id); const days = daysBetween(d.today, r.due_date); return (
                <li key={r.id}>
                  <Link to="/admin/accounts/$id" params={{ id: r.client_id }} className="flex items-center gap-3 py-2.5 hover:bg-ivory/60">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-semibold text-white sm:h-10 sm:w-10 sm:text-xs">{c?.flat_no || "—"}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-navy sm:text-base">{c?.full_name}</span><span className="block truncate text-xs text-muted-foreground">{r.label}<span className="sm:hidden"> · {days === 0 ? "today" : `in ${days}d`}</span></span></span>
                    <span className="shrink-0 text-right"><span className="block whitespace-nowrap text-sm font-semibold text-navy sm:text-base">{taka(r.amount - r.paid_amount)}</span><span className="block whitespace-nowrap text-[11px] text-muted-foreground sm:text-xs">{fmtDate(r.due_date)}<span className="hidden sm:inline"> · {days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}</span></span></span>
                  </Link>
                </li>
              ); })}
            </ul>
          )}
        </Card>

        <Card>
          <Head icon={AlertTriangle} title="Overdue clients" />
          {isLoading || !d ? <Skeleton className="h-40 w-full" /> : !d.overdue.length ? <Empty t="No overdue instalments — everyone is up to date." /> : (
            <ul className="divide-y divide-border">
              {d.overdue.map((o) => { const c = d.byId.get(o.id); return (
                <li key={o.id}>
                  <Link to="/admin/accounts/$id" params={{ id: o.id }} className="flex items-center gap-3 py-2.5 hover:bg-ivory/60">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red text-[11px] font-semibold text-white sm:h-10 sm:w-10 sm:text-xs">{c?.flat_no || "—"}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-navy sm:text-base">{c?.full_name}</span><span className="block truncate text-xs text-muted-foreground">Since {fmtDate(o.since)} · {daysBetween(o.since, d.today)} days</span></span>
                    <span className="shrink-0 text-right"><span className="block whitespace-nowrap text-sm font-semibold text-brand-red sm:text-base">{taka(o.amount)}</span>{o.fee > 0 && <span className="block whitespace-nowrap text-[11px] text-brand-red/80 sm:text-xs">+ {taka(o.fee)} fee</span>}</span>
                  </Link>
                </li>
              ); })}
            </ul>
          )}
        </Card>

        <Card>
          <Head icon={Banknote} title="Recent payments" />
          {isLoading || !d ? <Skeleton className="h-40 w-full" /> : !d.payments.length ? <Empty t="No payments recorded yet." /> : (
            <ul className="divide-y divide-border">
              {d.payments.map((p) => { const c = d.byId.get(p.client_id); return (
                <li key={p.id}>
                  <Link to="/admin/accounts/$id" params={{ id: p.client_id }} className="flex items-center gap-3 py-2.5 hover:bg-ivory/60">
                    <span className="hidden w-24 shrink-0 text-xs text-muted-foreground sm:block">{fmtDate(p.paid_on)}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-navy sm:text-base">{c?.flat_no} · {c?.full_name}</span><span className="block truncate text-xs text-muted-foreground"><span className="sm:hidden">{fmtDate(p.paid_on)} · </span>{p.type} · {p.method}</span></span>
                    <span className={`shrink-0 whitespace-nowrap text-sm font-semibold sm:text-base ${p.type === "Late fee" ? "text-brand-red" : "text-navy"}`}>{taka(p.amount)}</span>
                  </Link>
                </li>
              ); })}
            </ul>
          )}
        </Card>

        <Card>
          <Head icon={Inbox} title={d?.unread ? `Messages · ${d.unread} unread` : "Messages"} to="/admin/messages" />
          {isLoading || !d ? <Skeleton className="h-40 w-full" /> : !d.messages.length ? <Empty t="No messages yet." /> : (
            <ul className="divide-y divide-border">
              {d.messages.map((m) => (
                <li key={m.id}>
                  <Link to="/admin/messages" className="flex items-start gap-3 py-2.5 hover:bg-ivory/60">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${m.read_at ? "bg-navy/15" : "bg-brand-red"}`} aria-label={m.read_at ? "Read" : "Unread"} />
                    <span className="min-w-0 flex-1"><span className={`block truncate text-navy ${m.read_at ? "" : "font-semibold"}`}>{m.full_name} — {m.subject || "Message"}</span><span className="block truncate text-xs text-muted-foreground">{m.message}</span></span>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(m.created_at.slice(0, 10))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <Head icon={HardHat} title="Construction progress" to="/admin/construction" />
          {isLoading || !d ? <Skeleton className="h-28 w-full" /> : !d.projects.length ? <Empty t="No current projects." /> : (
            <ul className="space-y-4">
              {d.projects.map((p) => (
                <li key={p.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"><span className="font-medium text-navy">{p.name}</span><span className="text-muted-foreground">{p.status} · <b className="text-navy">{p.progress_pct}%</b></span></div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-navy/10"><div className="h-full rounded-full bg-navy" style={{ width: `${Math.min(100, Number(p.progress_pct))}%` }} /></div>
                  {p.status_updated_at && <p className="mt-1 text-[11px] text-muted-foreground">Updated {fmtDate(p.status_updated_at.slice(0, 10))}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <Head icon={Users} title="Website content" />
          <div className="grid grid-cols-2 gap-3">
            {tiles.map((t) => (
              <Link key={t.label} to={t.to} className="rounded-xl bg-ivory p-4 transition hover:bg-navy/5">
                <t.icon className="h-4 w-4 text-brand-red" />
                {isLoading ? <Skeleton className="mt-2 h-7 w-10" /> : <p className="num mt-2 text-2xl text-navy">{t.n}</p>}
                <p className="text-xs text-muted-foreground">{t.label}</p>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/admin/accounts/new" search={{}} className="btn btn-primary"><UserPlus className="h-4 w-4" /> Add client</Link>
        <Link to="/admin/accounts/import" className="btn btn-ghost-light"><FileSpreadsheet className="h-4 w-4" /> Import from Excel</Link>
        <Link to="/admin/videos" className="btn btn-ghost-light"><Plus className="h-4 w-4" /> Add video</Link>
        <Link to="/admin/projects/new" search={{ kind: "current" }} className="btn btn-ghost-light"><Plus className="h-4 w-4" /> Add project</Link>
        <Link to="/admin/media" className="btn btn-ghost-light"><Upload className="h-4 w-4" /> Upload media</Link>
      </div>
    </>
  );
}
