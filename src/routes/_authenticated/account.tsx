import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { BadgeCheck, Building2, Download, FileText, Heart, Home, KeyRound, LayoutDashboard, LifeBuoy, LogOut, Phone, Settings, Wallet, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppIcon } from "@/components/SiteChrome";
import { ProjectCard } from "@/components/ProjectCard";
import { normalizeBdPhone } from "@/components/InquiryForm";
import { publicProjectsQuery } from "@/lib/projects-data";
import { fmtDate, initials, printStatement, type BalanceRow, type ClientRow, type DocRow, type InstalmentRow, type PaymentRow, type Profile } from "@/lib/account";
import { taka, todayIso, totalLateFee } from "@/lib/money";
import { PaidRing, PaymentsTable, ScheduleTable, SummaryCards } from "@/components/ClientMoney";
import { company } from "@/lib/site";
import { setFirstPassword } from "@/lib/login.functions";

const TABS = ["overview", "home", "payments", "documents", "saved", "support", "profile"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/account")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => (TABS.includes(s["tab"] as Tab) ? { tab: s["tab"] as Tab } : {}),
  head: () => ({
    meta: [
      { title: "My account — Natec Development Ltd." },
      { name: "description", content: "Your Natec Development dashboard: saved projects, inquiries, and for clients, payments and documents." },
      { property: "og:title", content: "My account — Natec Development Ltd." },
      { property: "og:description", content: "Your Natec Development customer dashboard." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AccountPage,
});

function useMe(uid: string) {
  const profile = useQuery({
    queryKey: ["me", "profile", uid],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
  const client = useQuery({
    queryKey: ["me", "client", uid],
    enabled: profile.data?.account_type === "client" && profile.data.status === "active",
    queryFn: async () => {
      const { data: c, error } = await supabase.from("clients").select("*").eq("profile_id", uid).order("created_at").limit(1).maybeSingle();
      if (error) throw error;
      if (!c) return null;
      const [b, i, p, d] = await Promise.all([
        supabase.from("client_balances").select("*").eq("client_id", c.id).maybeSingle(),
        supabase.from("instalments_live").select("*").eq("client_id", c.id).order("due_date"),
        supabase.from("payments").select("*").eq("client_id", c.id).order("paid_on", { ascending: false }),
        supabase.from("client_documents").select("*").eq("client_id", c.id).order("uploaded_at", { ascending: false }),
      ]);
      return { client: c as ClientRow, balance: (b.data ?? null) as BalanceRow | null, instalments: (i.data ?? []) as InstalmentRow[], payments: (p.data ?? []) as PaymentRow[], docs: (d.data ?? []) as DocRow[] };
    },
  });
  return { profile, client };
}

function AccountPage() {
  const { user } = Route.useRouteContext();
  const { tab = "overview" } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile, client } = useMe(user.id);
  const isClient = !!client.data;
  const verified = !!user.email_confirmed_at;

  useEffect(() => { supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id).then(() => {}); }, [user.id]);

  async function logout() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }
  const p = profile.data;
  const name = p?.full_name || String(user.user_metadata?.["full_name"] ?? "");
  const menu: { t: Tab; label: string; icon: typeof Home; client?: boolean }[] = [
    { t: "overview", label: "Overview", icon: LayoutDashboard },
    { t: "home", label: "My home", icon: Home, client: true },
    { t: "payments", label: "Payments", icon: Wallet, client: true },
    { t: "documents", label: "Documents", icon: FileText, client: true },
    { t: "saved", label: "Saved projects", icon: Heart },
    { t: "support", label: "Support", icon: LifeBuoy },
    { t: "profile", label: "Profile", icon: Settings },
  ];
  const items = menu.filter((m) => !m.client || isClient);
  const active: Tab = items.some((m) => m.t === tab) ? tab : "overview";

  return (
    <section className="min-h-screen bg-ivory pb-24 pt-6 md:pt-10 lg:pb-12">
      <div className="container-x grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
        <aside className="hidden lg:block">
          <div className="sticky top-28 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy font-label text-lg text-white">{initials(name, user.email ?? "")}</span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-navy">{name || "Natec member"}</p>
                {verified && <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-red"><BadgeCheck className="h-3.5 w-3.5" /> Verified member</p>}
              </div>
            </div>
            <p className="mt-4 truncate text-sm text-muted-foreground">{user.email}</p>
            {p?.phone && <p className="text-sm text-muted-foreground">{p.phone}</p>}
            <nav className="mt-6 space-y-1" aria-label="Dashboard">
              {items.map((m) => (
                <Link key={m.t} to="/account" search={m.t === "overview" ? {} : { tab: m.t }} className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm transition ${active === m.t ? "bg-navy text-white" : "text-navy hover:bg-ivory"}`}>
                  <m.icon className="h-4 w-4" /> {m.label}
                </Link>
              ))}
            </nav>
            <button onClick={logout} className="mt-6 flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm text-brand-red hover:bg-brand-red/5"><LogOut className="h-4 w-4" /> Logout</button>
          </div>
        </aside>

        <main className="min-w-0">
          {p?.must_change_password && <SetPasswordBanner onSaved={() => qc.invalidateQueries({ queryKey: ["me"] })} />}
          {client.data?.client.is_demo && <p role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">This is a demo account. Figures are examples only.</p>}
          {profile.isLoading ? <div className="h-64 animate-pulse rounded-2xl bg-white" /> : p?.status === "suspended" ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm"><h1 className="!text-3xl text-navy">Account suspended</h1><p className="mt-3 text-muted-foreground">Your account is currently suspended. Please contact Natec for help.</p><a href={company.whatsappLink} target="_blank" rel="noreferrer" className="btn btn-primary mt-6"><WhatsAppIcon /> WhatsApp us</a></div>
          ) : (
            <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              {active === "overview" && <Overview name={name} isClient={isClient} uid={user.id} data={client.data ?? null} />}
              {active === "home" && client.data && <MyHome c={client.data.client} />}
              {active === "payments" && client.data && <Payments d={client.data} />}
              {active === "documents" && client.data && <Documents docs={client.data.docs} />}
              {active === "saved" && <Saved uid={user.id} />}
              {active === "support" && <Support uid={user.id} name={name} email={user.email ?? ""} phone={p?.phone ?? ""} />}
              {active === "profile" && p && <ProfileSettings p={p} onSaved={() => qc.invalidateQueries({ queryKey: ["me"] })} logout={logout} />}
            </motion.div>
          )}
        </main>
      </div>

      <nav aria-label="Dashboard" className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-border bg-white lg:hidden">
        {items.map((m) => (
          <Link key={m.t} to="/account" search={m.t === "overview" ? {} : { tab: m.t }} className={`flex min-h-[60px] min-w-[72px] flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] ${active === m.t ? "text-brand-red" : "text-navy/70"}`}>
            <m.icon className="h-5 w-5" /> <span className="whitespace-nowrap">{m.label.replace(" projects", "")}</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}

function H({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return <div className="mb-6"><h1 className="!text-3xl text-navy md:!text-4xl">{children}</h1>{sub && <p className="mt-2 text-muted-foreground">{sub}</p>}</div>;
}
const card = "rounded-2xl bg-white p-6 shadow-sm";

function Overview({ name, isClient, uid, data }: { name: string; isClient: boolean; uid: string; data: { balance: BalanceRow | null } | null }) {
  const { data: projects = [] } = useQuery(publicProjectsQuery);
  const { data: saved = 0 } = useQuery({ queryKey: ["me", "saved-count", uid], queryFn: async () => (await supabase.from("saved_projects").select("project_id", { count: "exact", head: true })).count ?? 0 });
  const ongoing = projects.filter((p) => p.kind === "current" && p.status !== "Completed").length;
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl p-8 text-white md:p-10" style={{ background: "linear-gradient(135deg, #041a38, #072F63)" }}>
        <img src="/projects/shobuj-angon/front.webp" alt="" aria-hidden className="absolute inset-y-0 right-0 h-full w-1/2 object-cover opacity-15" />
        <p className="eyebrow relative text-white/60">Dashboard</p>
        <h1 className="relative mt-2 !text-3xl md:!text-4xl">Welcome{name ? `, ${name.split(" ")[0]}` : ""}</h1>
        <p className="relative mt-2 max-w-[48ch] text-white/80">{isClient ? "Your home, payments and documents are all here." : "Save projects, follow construction and talk to our team."}</p>
      </div>
      {!isClient && (
        <div className={`${card} border-l-4 border-brand-red`}>
          <p className="font-display text-xl text-navy">Become a Natec client</p>
          <p className="mt-1 text-muted-foreground">Once you book a flat, your account is upgraded to the client portal with your payment schedule and construction progress.</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {[["Saved projects", String(saved)], ["Ongoing projects", String(ongoing)], ["Account status", isClient ? "Client" : "Member"]].map(([k, v]) => (
          <div key={k} className={card}><p className="eyebrow !text-[10px] text-muted-foreground">{k}</p><p className="mt-2 font-display text-3xl text-navy">{v}</p></div>
        ))}
      </div>
      {isClient && data?.balance && (
        <div className={card}><p className="eyebrow !text-[10px] text-muted-foreground">Payments</p><p className="mt-2 text-navy">{taka(data.balance.total_paid)} paid of {taka(data.balance.total_price)}</p><Link to="/account" search={{ tab: "payments" }} className="mt-3 inline-block text-sm text-brand-red">See payments →</Link></div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/projects" className="btn border border-navy text-navy">Browse projects</Link>
        <Link to="/construction-status" className="btn border border-navy text-navy">Construction status</Link>
        <a href={`${company.whatsappLink}?text=${encodeURIComponent("Hi Natec, I'd like to book a site visit.")}`} target="_blank" rel="noreferrer" className="btn btn-primary"><WhatsAppIcon /> Book a site visit</a>
      </div>
    </div>
  );
}

function Saved({ uid }: { uid: string }) {
  const { data: projects = [], isLoading: l1 } = useQuery(publicProjectsQuery);
  const { data: ids = [], isLoading } = useQuery({
    queryKey: ["me", "saved-ids", uid],
    queryFn: async () => ((await supabase.from("saved_projects").select("project_id").order("created_at", { ascending: false })).data ?? []).map((r) => r.project_id),
  });
  const list = ids.map((id) => projects.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  return (
    <div>
      <H>Saved projects</H>
      {isLoading || l1 ? <div className="h-64 animate-pulse rounded-2xl bg-white" /> : list.length === 0 ? (
        <div className={`${card} text-center`}><Heart className="mx-auto h-8 w-8 text-brand-red" /><p className="mt-3 font-display text-xl text-navy">No saved projects yet</p><p className="mt-1 text-muted-foreground">Tap the heart on any project to save it here.</p><Link to="/projects" className="btn btn-primary mt-5">Explore projects</Link></div>
      ) : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{list.map((p) => <ProjectCard key={p.id} p={p} />)}</div>}
    </div>
  );
}

function Support({ uid, name, email, phone }: { uid: string; name: string; email: string; phone: string }) {
  const qc = useQueryClient();
  const { data: projects = [] } = useQuery(publicProjectsQuery);
  const list = useQuery({
    queryKey: ["me", "inquiries", uid],
    queryFn: async () => (await supabase.from("contact_submissions").select("id, subject, service, message, status, created_at").eq("user_id", uid).order("created_at", { ascending: false })).data ?? [],
  });
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const subject = String(f.get("subject") || "").trim().slice(0, 150), message = String(f.get("message") || "").trim().slice(0, 2000);
    if (!subject || !message) return void toast.error("Please add a subject and a message.");
    setBusy(true);
    const { error } = await supabase.from("contact_submissions").insert({ user_id: uid, full_name: name || email, phone: phone || "—", email, subject, service: String(f.get("project") || "") || null, message });
    setBusy(false);
    if (error) return void toast.error("Couldn't send your message. Please try again.");
    toast.success("Message sent — our team will get back to you.");
    form.reset(); qc.invalidateQueries({ queryKey: ["me", "inquiries", uid] });
  }
  const tone = (s: string) => (s === "Answered" ? "bg-navy text-white" : s === "In progress" ? "border border-brand-red text-brand-red" : "bg-muted text-navy");
  return (
    <div className="space-y-6">
      <H sub="Ask us anything about a project, a visit or your booking.">Support & inquiries</H>
      <form onSubmit={submit} className={`${card} space-y-4`}>
        <label className="block text-sm font-medium text-navy">Subject<input name="subject" maxLength={150} className="admin-input mt-1" /></label>
        <label className="block text-sm font-medium text-navy">Project
          <select name="project" className="admin-input mt-1"><option value="">General</option>{projects.map((p) => <option key={p.id}>{p.name}</option>)}</select>
        </label>
        <label className="block text-sm font-medium text-navy">Message<textarea name="message" rows={4} maxLength={2000} className="admin-input mt-1" /></label>
        <button disabled={busy} className="btn btn-primary disabled:opacity-60">{busy ? "Sending…" : "Send message"}</button>
      </form>
      <div className={card}>
        <h2 className="!text-xl text-navy">Your inquiries</h2>
        {list.isLoading ? <div className="mt-4 h-20 animate-pulse rounded-xl bg-muted" /> : !list.data?.length ? <p className="mt-3 text-muted-foreground">No inquiries yet.</p> : (
          <ul className="mt-4 divide-y divide-border">
            {list.data.map((m) => (
              <li key={m.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-navy">{m.subject || m.service || "Inquiry"}</p><span className={`font-label rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${tone(m.status)}`}>{m.status}</span></div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{fmtDate(m.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ProfileSettings({ p, onSaved, logout }: { p: Profile; onSaved: () => void; logout: () => void }) {
  const [busy, setBusy] = useState("");
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("full_name") || "").trim(), phone = normalizeBdPhone(String(f.get("phone") || ""));
    if (!name) return void toast.error("Enter your name.");
    if (!phone) return void toast.error("Enter a Bangladesh mobile number, e.g. 01712-345678.");
    setBusy("p");
    const { error } = await supabase.from("profiles").update({ full_name: name, phone }).eq("id", p.id);
    await supabase.auth.updateUser({ data: { full_name: name, phone } });
    setBusy("");
    if (error) return void toast.error("Couldn't save. Please try again.");
    toast.success("Profile saved"); onSaved();
  }
  async function changePw(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const cur = String(f.get("current") || ""), nw = String(f.get("new") || ""), c = String(f.get("confirm") || "");
    if (nw.length < 8) return void toast.error("New password must be at least 8 characters.");
    if (nw !== c) return void toast.error("Passwords don't match.");
    setBusy("pw");
    const { error } = await supabase.auth.updateUser({ password: nw, current_password: cur } as { password: string });
    setBusy("");
    if (error) return void toast.error(/current/i.test(error.message) ? "Your current password is incorrect." : error.message);
    toast.success("Password changed"); form.reset();
  }
  async function everywhere() {
    await supabase.auth.signOut({ scope: "global" });
    logout();
  }
  return (
    <div className="space-y-6">
      <H>Profile settings</H>
      <form onSubmit={save} className={`${card} grid gap-4 md:grid-cols-2`}>
        <label className="text-sm font-medium text-navy">Full name<input name="full_name" defaultValue={p.full_name} maxLength={120} className="admin-input mt-1" /></label>
        <label className="text-sm font-medium text-navy">Phone<input name="phone" type="tel" defaultValue={p.phone} className="admin-input mt-1" /></label>
        <label className="text-sm font-medium text-navy md:col-span-2">Email<input value={p.email} disabled className="admin-input mt-1 opacity-60" /></label>
        <div><button disabled={busy === "p"} className="btn btn-primary disabled:opacity-60">{busy === "p" ? "Saving…" : "Save changes"}</button></div>
      </form>
      <form onSubmit={changePw} className={`${card} grid gap-4 md:grid-cols-3`}>
        <h2 className="!text-xl text-navy md:col-span-3">Change password</h2>
        <label className="text-sm font-medium text-navy">Current password<input name="current" type="password" autoComplete="current-password" className="admin-input mt-1" /></label>
        <label className="text-sm font-medium text-navy">New password<input name="new" type="password" autoComplete="new-password" className="admin-input mt-1" /></label>
        <label className="text-sm font-medium text-navy">Confirm new password<input name="confirm" type="password" autoComplete="new-password" className="admin-input mt-1" /></label>
        <div><button disabled={busy === "pw"} className="btn btn-primary disabled:opacity-60">{busy === "pw" ? "Saving…" : "Change password"}</button></div>
      </form>
      <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
        <div><h2 className="!text-xl text-navy">Sign out of all devices</h2><p className="text-sm text-muted-foreground">Ends your session on every phone and computer.</p></div>
        <button onClick={everywhere} className="btn border border-brand-red text-brand-red">Sign out everywhere</button>
      </div>
    </div>
  );
}

function MyHome({ c }: { c: ClientRow }) {
  const { data: projects = [] } = useQuery(publicProjectsQuery);
  const p = projects.find((x) => x.id === c.project_id);
  return (
    <div>
      <H>My home</H>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {p?.cover && <img src={p.cover.public_url} alt={p.cover.alt_text || p.name} width={1200} height={600} className="aspect-[2/1] w-full object-cover" />}
        <div className="p-6">
          <p className="eyebrow text-brand-red">{p?.project_no}</p>
          <h2 className="!text-3xl text-navy">{p?.name ?? "Your project"}</h2>
          <dl className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
            {[["Flat no.", c.flat_no || "—"], ["Floor", c.floor || "—"], ["Size", c.size_sft ? `${c.size_sft.toLocaleString("en-IN")} sft` : "—"], ["Parking", c.parking ? "Yes" : "No"], ["Booking date", fmtDate(c.booking_date)]].map(([k, v]) => (
              <div key={k}><dt className="eyebrow !text-[10px] text-muted-foreground">{k}</dt><dd className="mt-1 font-semibold text-navy">{v}</dd></div>
            ))}
          </dl>
          {p && <Link to="/construction-status/$slug" params={{ slug: p.slug }} className="btn btn-primary mt-6"><Building2 className="h-4 w-4" /> Construction status</Link>}
        </div>
      </div>
    </div>
  );
}

function Payments({ d }: { d: { client: ClientRow; balance: BalanceRow | null; instalments: InstalmentRow[]; payments: PaymentRow[] } }) {
  const { data: projects = [] } = useQuery(publicProjectsQuery);
  const pct = Number(d.balance?.pct_paid ?? 0);
  const pname = projects.find((p) => p.id === d.client.project_id)?.name ?? "";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <H>Payments</H>
        <button onClick={() => printStatement({ client: d.client, projectName: pname, balance: d.balance, instalments: d.instalments, payments: d.payments })} className="btn border border-navy text-navy"><Download className="h-4 w-4" /> Download statement (PDF)</button>
      </div>
      <SummaryCards c={d.client} b={d.balance} late={totalLateFee(d.instalments.map((i) => ({ label: i.label ?? "", due_date: i.due_date ?? "", amount: Number(i.amount), paid_amount: Number(i.paid_amount) })), todayIso())} />
      <div className={`${card} flex flex-col items-center gap-6 sm:flex-row`}>
        <PaidRing pct={pct} />
        <div className="w-full">
          <div className="flex justify-between text-sm font-semibold text-navy"><span>Paid {taka(d.balance?.total_paid)}</span><span>of {taka(d.client.total_price)}</span></div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-navy/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Paid"><div className="h-full rounded-full bg-brand-red" style={{ width: `${Math.min(100, pct)}%` }} /></div>
        </div>
      </div>
      <div className={card}><h2 className="mb-2 !text-xl text-navy">Instalment schedule</h2><ScheduleTable rows={d.instalments} /></div>
      <div className={card}><h2 className="mb-2 !text-xl text-navy">Payment history</h2><PaymentsTable rows={d.payments} /></div>
      <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
        <p className="text-sm text-muted-foreground">Records are maintained by Natec's accounts team. For corrections, contact us.</p>
        <div className="flex gap-2"><a href={company.whatsappLink} target="_blank" rel="noreferrer" className="btn btn-primary"><WhatsAppIcon /> WhatsApp</a><a href={company.phoneLink} className="btn border border-navy text-navy"><Phone className="h-4 w-4" /> Call</a></div>
      </div>
    </div>
  );
}

function Documents({ docs }: { docs: DocRow[] }) {
  async function open(d: DocRow) {
    const { data, error } = await supabase.storage.from("client-docs").createSignedUrl(d.storage_path, 60);
    if (error || !data) return void toast.error("Couldn't open this document. Please try again.");
    window.open(data.signedUrl, "_blank", "noopener");
  }
  return (
    <div>
      <H sub="Allotment letter, receipts, agreement and other papers.">Documents</H>
      {!docs.length ? <div className={`${card} text-center text-muted-foreground`}>No documents uploaded yet.</div> : (
        <ul className="space-y-3">
          {docs.map((d) => (
            <li key={d.id} className={`${card} flex items-center justify-between gap-4 !p-4`}>
              <span className="flex min-w-0 items-center gap-3"><FileText className="h-5 w-5 shrink-0 text-brand-red" /><span className="min-w-0"><span className="block truncate font-medium text-navy">{d.title}</span><span className="text-xs text-muted-foreground">{fmtDate(d.uploaded_at)}</span></span></span>
              <button onClick={() => open(d)} className="btn border border-navy !px-4 text-navy"><Download className="h-4 w-4" /> Download</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Shown while the client still uses the temporary password from the office. They can log in and use
 * everything with it; this just invites them to choose their own. "Later" hides it until the next visit.
 */
function SetPasswordBanner({ onSaved }: { onSaved: () => void }) {
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem("natec-pw-later") === "1"; } catch { return false; } });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (hidden) return null;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password") || ""), confirm = String(f.get("confirm") || "");
    if (password.length < 8) return setErr("Use at least 8 characters.");
    if (confirm !== password) return setErr("Passwords don't match.");
    setBusy(true); setErr("");
    const r = await setFirstPassword({ data: { password } }).catch(() => ({ error: "Couldn't save your password. Please try again." }));
    setBusy(false);
    if ("error" in r) return setErr(r.error);
    if (r.access_token) await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
    toast.success("Your new password is saved");
    onSaved();
  }
  const later = () => { try { sessionStorage.setItem("natec-pw-later", "1"); } catch { /* ignore */ } setHidden(true); };
  return (
    <div role="status" className="mb-5 rounded-2xl border border-brand-red/20 bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-red/10 text-brand-red"><KeyRound className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-navy">Set a new password</p>
          <p className="text-sm text-muted-foreground">You are using the password from our office. Choose your own to keep your account safe.</p>
        </div>
        {!open && <button onClick={() => setOpen(true)} className="btn btn-primary !py-2">Set new password</button>}
        <button onClick={later} className="rounded-full p-2 text-navy/60 hover:bg-ivory hover:text-navy" aria-label="Remind me later"><X className="h-4 w-4" /></button>
      </div>
      {open && (
        <form onSubmit={submit} noValidate className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-sm font-medium text-navy">New password<input name="password" type="password" autoComplete="new-password" className="admin-input mt-1" /></label>
          <label className="text-sm font-medium text-navy">Confirm new password<input name="confirm" type="password" autoComplete="new-password" className="admin-input mt-1" /></label>
          <button disabled={busy} className="btn btn-primary !py-2.5 disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
          {err && <p role="alert" className="text-sm font-medium text-brand-red sm:col-span-3">{err}</p>}
        </form>
      )}
    </div>
  );
}
