import { useEffect, useMemo, useState } from "react";
import { SITE_URL } from "@/lib/site";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarCheck, Clock, Gauge, MapPin, Phone } from "lucide-react";
import { UnderConstruction } from "@/components/UnderConstruction";
import { PageHero, Reveal, WhatsAppIcon } from "@/components/SiteChrome";
import { Lightbox } from "@/components/Lightbox";
import { waMessage } from "@/components/ProjectsGrid";
import { normalizeBdPhone } from "@/components/InquiryForm";
import { supabase } from "@/integrations/supabase/client";
import { publicProjectsQuery, type MediaRow, type ProjectWithMedia } from "@/lib/projects-data";
import { averagePct, CATEGORIES, CATEGORY_SHORT, constructionQuery, isListed, monthYear, type Category, type ItemRow, type UpdateWithPhotos } from "@/lib/construction-data";
import { company } from "@/lib/site";

const SITE = SITE_URL;
const abs = (u?: string | null) => (!u ? null : /^https?:/.test(u) ? u : `${SITE}${u.startsWith("/") ? "" : "/"}${u}`);

export const Route = createFileRoute("/construction-status_/$slug")({
  loader: async ({ context, params }) => {
    const all = await context.queryClient.ensureQueryData(publicProjectsQuery);
    const p = all.find((x) => x.slug === params.slug);
    if (!p || !isListed(p)) throw notFound();
    return { name: p.name, short: p.location_short || p.address, pct: p.progress_pct, image: abs(p.cover?.public_url) };
  },
  head: ({ loaderData: d, params }) => {
    if (!d) return { meta: [{ title: "Construction status unavailable | Natec Development" }, { name: "robots", content: "noindex" }] };
    const title = `${d.name} Construction Status | Natec Development`;
    const desc = `Construction progress of ${d.name}, ${d.short}: ${d.pct}% complete. Work-by-work report and monthly site photos from Natec Development.`;
    const url = `${SITE}/construction-status/${params.slug}`;
    return {
      meta: [
        { title }, { name: "description", content: desc },
        { property: "og:title", content: title }, { property: "og:description", content: desc },
        { property: "og:type", content: "website" }, { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        ...(d.image ? [{ property: "og:image", content: d.image }, { name: "twitter:image", content: d.image }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org", "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
            { "@type": "ListItem", position: 2, name: "Construction Status", item: `${SITE}/construction-status` },
            { "@type": "ListItem", position: 3, name: d.name, item: url },
          ],
        }),
      }],
    };
  },
  component: () => <UnderConstruction title="Construction Status" real={StatusPage} />,
  errorComponent: () => <p className="p-10 pt-32 text-center">This status page could not be loaded. Please refresh.</p>,
  notFoundComponent: () => (
    <section className="bg-ivory px-5 pb-24 pt-36 text-center">
      <p className="eyebrow text-brand-red">404</p>
      <h1 className="mt-3 text-primary">Status page not found</h1>
      <p className="mx-auto mt-4 max-w-[46ch] text-muted-foreground">This project doesn't have a construction status page yet.</p>
      <Link to="/construction-status" className="btn btn-primary mt-8">All construction updates</Link>
    </section>
  ),
});

function useInView<T extends Element>() {
  const [el, setEl] = useState<T | null>(null);
  const [inView, setIn] = useState(false);
  useEffect(() => {
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setIn(true);
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setIn(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  return [setEl, inView] as const;
}

function Ring({ pct, on }: { pct: number; on: boolean }) {
  const r = 84, c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto h-52 w-52 md:h-60 md:w-60">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="100" cy="100" r={r} fill="none" strokeWidth="14" className="stroke-navy" />
        <circle cx="100" cy="100" r={r} fill="none" strokeWidth="14" strokeLinecap="round" className="stroke-brand-red cs-anim"
          strokeDasharray={c} strokeDashoffset={on ? c * (1 - pct / 100) : c} style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.2,.7,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-6xl text-navy">{pct}%</span>
        <span className="eyebrow mt-1 !text-[10px] text-muted-foreground">Overall</span>
      </div>
    </div>
  );
}

function Bar({ pct, on = true, thin }: { pct: number; on?: boolean; thin?: boolean }) {
  return (
    <div className={`${thin ? "h-1.5" : "h-2.5"} w-full overflow-hidden rounded-full bg-navy/10`}>
      <div className="cs-anim h-full rounded-full bg-brand-red" style={{ width: on ? `${pct}%` : "0%", transition: "width 1.2s cubic-bezier(.2,.7,.2,1)" }} />
    </div>
  );
}

function Chip({ s }: { s: string }) {
  const tone = s === "Done" ? "bg-navy text-white" : s === "In progress" ? "border border-brand-red text-brand-red" : s === "Not started" ? "bg-muted text-muted-foreground" : "text-muted-foreground italic";
  return <span className={`font-label inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${tone}`}>{s}</span>;
}

function StatusPage() {
  const { slug } = Route.useParams();
  const { data: all } = useSuspenseQuery(publicProjectsQuery);
  const list = all.filter(isListed);
  const idx = list.findIndex((x) => x.slug === slug);
  const p = list[idx];
  const cq = useQuery({ ...constructionQuery(p?.id ?? ""), enabled: !!p });
  if (!p) return null;
  const prev = list[idx - 1], next = list[idx + 1];
  const wa = waMessage(`Hi Natec, please send me construction updates for ${p.name}.`);
  const items = cq.data?.items ?? [];

  return (
    <div className="pb-20 lg:pb-0">
      <PageHero
        image={p.cover?.public_url ?? "/hero-natec/d/0040.webp"}
        imageAlt={p.cover?.alt_text || `${p.name} construction by Natec Development`}
        crumbs={[{ label: "Home", to: "/" }, { label: "Construction Status", to: "/construction-status" }, { label: p.name }]}
        eyebrow={p.project_no || "Project"}
        title={p.name}
        intro={p.address}
        heightClass="min-h-[62svh] md:min-h-[64svh]"
        top={<Link to="/construction-status" className="eyebrow inline-flex min-h-[44px] items-center gap-2 !text-[12px] text-white/85 hover:text-white"><ArrowLeft className="h-4 w-4" /> All projects</Link>}
      />

      <section className="bg-ivory py-8 md:py-10" aria-label="Project summary">
        <dl className="container-x grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {[
            { icon: MapPin, k: "Location", v: p.location_short || p.address || "—" },
            { icon: CalendarCheck, k: "Expected completion", v: p.expected_completion || "To be announced" },
            { icon: Clock, k: "Last updated", v: monthYear(p.status_updated_at) || "—" },
            { icon: Gauge, k: "Overall progress", v: `${p.progress_pct}%` },
          ].map((f) => (
            <div key={f.k} className="rounded-2xl bg-white p-4 shadow-sm md:p-6">
              <f.icon className="h-5 w-5 text-brand-red" aria-hidden />
              <dt className="eyebrow mt-3 !text-[10px] text-muted-foreground">{f.k}</dt>
              <dd className="mt-1 font-semibold text-navy">{f.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Overview p={p} items={items} loading={cq.isLoading} />

      <section className="section-pad bg-ivory">
        <div className="container-x">
          <h2 className="text-primary">Work-by-work report</h2>
          {cq.isLoading ? <div className="mt-8 h-64 animate-pulse rounded-2xl bg-muted" /> : p.status_details_published && items.length > 0 ? <Report items={items} /> : (
            <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-sm md:p-12">
              <p className="font-display text-2xl text-navy">Detailed work-by-work update coming soon.</p>
              <p className="mt-2 text-muted-foreground">Overall progress: {p.progress_pct}%.</p>
              <a href={wa} target="_blank" rel="noreferrer" className="btn btn-primary mt-6"><WhatsAppIcon /> Ask on WhatsApp</a>
            </div>
          )}
        </div>
      </section>

      <Photos updates={cq.data?.updates ?? []} loading={cq.isLoading} name={p.name} />

      <nav aria-label="Project navigation" className="border-t border-border bg-white">
        <div className="container-x flex flex-col gap-3 py-8 sm:flex-row sm:items-center sm:justify-between">
          {prev ? <Link to="/construction-status/$slug" params={{ slug: prev.slug }} className="inline-flex min-h-[44px] items-center gap-2 text-navy hover:text-brand-red"><ArrowLeft className="h-4 w-4" /> Previous project: {prev.name}</Link> : <span />}
          <Link to="/projects/$slug" params={{ slug: p.slug }} className="eyebrow inline-flex min-h-[44px] items-center !text-[12px] text-brand-red">View {p.name} project page</Link>
          {next ? <Link to="/construction-status/$slug" params={{ slug: next.slug }} className="inline-flex min-h-[44px] items-center gap-2 text-navy hover:text-brand-red">Next project: {next.name} <ArrowRight className="h-4 w-4" /></Link> : <span />}
        </div>
      </nav>

      <Subscribe p={p} wa={wa} />

      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-border bg-white/95 p-3 backdrop-blur lg:hidden">
        <a href={company.phoneLink} className="btn flex-1 border border-navy !px-3 text-navy"><Phone className="h-4 w-4" /> Call</a>
        <a href={wa} target="_blank" rel="noreferrer" className="btn btn-primary flex-1 !px-3"><WhatsAppIcon /> WhatsApp</a>
      </div>
    </div>
  );
}

function Overview({ p, items, loading }: { p: ProjectWithMedia; items: ItemRow[]; loading: boolean }) {
  const [ref, on] = useInView<HTMLDivElement>();
  const cats = CATEGORIES.map((c) => ({ c, avg: averagePct(items.filter((i) => i.category === c)) }));
  const showBars = p.status_details_published && items.length > 0;
  return (
    <section className="section-pad bg-white">
      <div ref={ref} className="container-x grid items-center gap-12 md:grid-cols-[auto_1fr] md:gap-20">
        <div>
          <h2 className="sr-only">Overall progress</h2>
          <Ring pct={p.progress_pct} on={on} />
        </div>
        <div>
          <p className="eyebrow text-brand-red">Progress by category</p>
          {loading ? <div className="mt-6 h-48 animate-pulse rounded-xl bg-muted" /> : showBars ? (
            <ul className="mt-6 space-y-5">
              {cats.map(({ c, avg }) => (
                <li key={c}>
                  <div className="flex justify-between gap-3 text-sm"><span className="font-medium text-navy">{c}</span><span className="font-semibold text-navy">{avg == null ? "N/A" : `${avg}%`}</span></div>
                  <div className="mt-2"><Bar pct={avg ?? 0} on={on} /></div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 max-w-[46ch] text-muted-foreground">A category-by-category breakdown will appear here once our site engineers publish the detailed report.</p>}
        </div>
      </div>
    </section>
  );
}

function Report({ items }: { items: ItemRow[] }) {
  const [cat, setCat] = useState<Category | "All">("All");
  const [st, setSt] = useState<"All" | "Done" | "In progress" | "Not started">("All");
  const numbered = useMemo(() => {
    let n = 0;
    return CATEGORIES.flatMap((c) => items.filter((i) => i.category === c).map((i) => ({ ...i, no: ++n })));
  }, [items]);
  const shown = numbered.filter((i) => (cat === "All" || i.category === cat) && (st === "All" || i.status === st));
  const groups = CATEGORIES.map((c) => ({ c, rows: shown.filter((i) => i.category === c) })).filter((g) => g.rows.length);
  const chip = (active: boolean) => `font-label min-h-[44px] rounded-full px-4 text-[11px] uppercase tracking-[0.12em] transition ${active ? "bg-navy text-white" : "bg-white text-navy hover:bg-navy/5"}`;
  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {(["All", ...CATEGORIES] as const).map((c) => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)} className={chip(cat === c)}>{c === "All" ? "All" : CATEGORY_SHORT[c]}</button>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {(["All", "Done", "In progress", "Not started"] as const).map((s) => <button key={s} aria-pressed={st === s} onClick={() => setSt(s)} className={chip(st === s)}>{s}</button>)}
      </div>

      {groups.length === 0 ? <p className="mt-8 rounded-2xl bg-white p-8 text-center text-muted-foreground">No work items match these filters.</p> : (
        <div className="mt-8 overflow-clip rounded-2xl bg-white shadow-sm">
          <div className="font-label hidden grid-cols-[64px_1fr_240px_140px] gap-4 border-b border-border px-6 py-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground md:grid">
            <span>No.</span><span>Work</span><span>Progress</span><span>Status</span>
          </div>
          {groups.map((g) => (
            <div key={g.c}>
              <h3 className="sticky top-16 z-10 border-b border-border bg-ivory px-4 py-3 !text-lg text-navy md:top-[72px] md:px-6">{g.c}</h3>
              <ul>
                {g.rows.map((i) => (
                  <li key={i.id} className="border-b border-border/70 px-4 py-4 last:border-0 md:grid md:grid-cols-[64px_1fr_240px_140px] md:items-center md:gap-4 md:px-6">
                    <span className="hidden text-sm text-muted-foreground md:block">{String(i.no).padStart(2, "0")}</span>
                    <div className="flex items-start justify-between gap-3 md:block">
                      <span className="text-navy">{i.name}</span>
                      <span className="shrink-0 md:hidden"><Chip s={i.status} /></span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 md:mt-0">
                      {i.status === "Not applicable" ? <span className="text-sm text-muted-foreground">—</span> : <><Bar pct={i.progress_pct} thin /><span className="w-10 shrink-0 text-right text-sm font-semibold text-navy">{i.progress_pct}%</span></>}
                    </div>
                    <span className="hidden md:block"><Chip s={i.status} /></span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
        {(["Done", "In progress", "Not started", "Not applicable"] as const).map((s) => <Chip key={s} s={s} />)}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Progress figures are updated by our site engineers.</p>
    </div>
  );
}

function Photos({ updates, loading, name }: { updates: UpdateWithPhotos[]; loading: boolean; name: string }) {
  const [all, setAll] = useState(false);
  const [lb, setLb] = useState<{ items: MediaRow[]; i: number; label: string } | null>(null);
  const shown = all ? updates : updates.slice(0, 3);
  return (
    <section className="section-pad bg-white">
      <div className="container-x">
        <h2 className="text-primary">Monthly site photos</h2>
        {loading ? <div className="mt-8 h-64 animate-pulse rounded-2xl bg-muted" /> : updates.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-ivory p-8 text-center text-muted-foreground">Site photo updates will be posted here every month.</p>
        ) : (
          <ol className="relative mt-10 space-y-14 border-l-2 border-navy/15 pl-6 md:pl-10">
            {shown.map((u) => (
              <Reveal key={u.id}>
                <li className="relative">
                  <span className="absolute -left-[33px] top-1 h-4 w-4 rounded-full border-4 border-white bg-brand-red ring-2 ring-brand-red md:-left-[49px]" aria-hidden />
                  <p className="eyebrow !text-[11px] text-brand-red">{monthYear(u.month)}</p>
                  {u.title && <h3 className="mt-1 !text-2xl text-navy">{u.title}</h3>}
                  {u.note && <p className="mt-2 max-w-[66ch] whitespace-pre-line text-muted-foreground">{u.note}</p>}
                  {u.photos.length > 0 && (
                    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                      {u.photos.map((m, i) => (
                        <button key={m.id} onClick={() => setLb({ items: u.photos, i, label: `${name} — ${monthYear(u.month)}` })} className="group overflow-hidden rounded-xl" aria-label={`Open photo: ${m.alt_text || `${name} site photo ${i + 1}`}`}>
                          <img loading="lazy" src={m.public_url} alt={m.alt_text || `${name} site photo, ${monthYear(u.month)}`} width={m.width ?? 800} height={m.height ?? 600} className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105" />
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              </Reveal>
            ))}
          </ol>
        )}
        {!all && updates.length > 3 && <button onClick={() => setAll(true)} className="btn mt-10 border border-navy text-navy">Show older updates</button>}
      </div>
      {lb && <Lightbox items={lb.items} index={lb.i} onIndex={(i) => setLb({ ...lb, i })} onClose={() => setLb(null)} label={lb.label} />}
    </section>
  );
}

function Subscribe({ p, wa }: { p: ProjectWithMedia; wa: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (String(f.get("website") || "")) return setState("done");
    const name = String(f.get("name") || "").trim();
    const phone = normalizeBdPhone(String(f.get("phone") || ""));
    const email = String(f.get("email") || "").trim() || null;
    if (!name) return setErr("Please enter your name.");
    if (!phone) return setErr("Please enter a valid Bangladesh mobile number, e.g. 01712-345678.");
    setErr(""); setState("sending");
    const { error } = await supabase.from("construction_subscribers").insert({ name: name.slice(0, 120), phone, email: email?.slice(0, 200) ?? null, project_id: p.id });
    if (error) { setState("idle"); setErr("Sorry, something went wrong. Please try again or message us on WhatsApp."); return; }
    setState("done");
  }
  const input = "w-full min-h-[48px] rounded-xl border border-white/20 bg-white/10 px-4 text-white placeholder:text-white/50 focus:border-white focus:outline-none";
  return (
    <section className="bg-navy text-white">
      <div className="container-x grid gap-10 py-16 md:grid-cols-2 md:items-center md:py-24">
        <div>
          <p className="eyebrow text-white/60">Get updates</p>
          <h2 className="mt-3">Never miss an update</h2>
          <p className="mt-4 max-w-[46ch] text-white/80">Leave your number and we'll let you know when new progress and site photos for {p.name} are posted.</p>
          <a href={wa} target="_blank" rel="noreferrer" className="btn btn-primary mt-8"><WhatsAppIcon /> Get updates on WhatsApp</a>
        </div>
        {state === "done" ? (
          <div className="rounded-2xl bg-white/10 p-8" role="status">
            <p className="font-display text-2xl">Thank you — you're on the list.</p>
            <p className="mt-2 text-white/80">We'll share {p.name} updates with you.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3" noValidate>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            <label className="block"><span className="sr-only">Your name</span><input name="name" required maxLength={120} placeholder="Your name" autoComplete="name" className={input} /></label>
            <label className="block"><span className="sr-only">Phone</span><input name="phone" required type="tel" inputMode="tel" placeholder="Phone (01XXX-XXXXXX)" autoComplete="tel" className={input} /></label>
            <label className="block"><span className="sr-only">Email (optional)</span><input name="email" type="email" maxLength={200} placeholder="Email (optional)" autoComplete="email" className={input} /></label>
            {err && <p role="alert" className="text-sm text-white">{err}</p>}
            <button disabled={state === "sending"} className="btn w-full bg-white text-navy hover:bg-ivory disabled:opacity-60">{state === "sending" ? "Sending…" : `Get ${p.name} updates`}</button>
          </form>
        )}
      </div>
    </section>
  );
}
