import { UnderConstruction } from "@/components/UnderConstruction";
import { SITE_URL } from "@/lib/site";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MapPinned, FileCheck2, HardHat, KeyRound, Wallet, ClipboardList, UserRound, ArrowRight } from "lucide-react";
import { PageHero, Reveal, WhatsAppIcon } from "@/components/SiteChrome";
import { ProjectCard } from "@/components/ProjectCard";
import { waMessage, WA_UPCOMING } from "@/components/ProjectsGrid";
import { publicProjectsQuery, type ProjectWithMedia } from "@/lib/projects-data";

const SITE = SITE_URL;
const TABS = ["all", "completed", "ongoing", "upcoming"] as const;
type Tab = (typeof TABS)[number];
const TITLE = "Residential Projects in Gazipur | Natec Development Ltd.";
const DESC = "Natec residential projects in Rajendrapur, Sreepur, Gazipur: 75 homes delivered or under construction, all sold, plus upcoming projects.";
const WA_VISIT = waMessage("Hi Natec, I'd like to book a site visit at Rajendrapur Bazar.");

function matchesTab(p: Pick<ProjectWithMedia, "kind" | "status">, tab: Tab) {
  if (tab === "all") return true;
  if (tab === "upcoming") return p.kind === "upcoming";
  if (p.kind === "upcoming") return false;
  return tab === "completed" ? p.status === "Completed" : p.status !== "Completed";
}

export const Route = createFileRoute("/projects")({
  validateSearch: (s: Record<string, unknown>): { filter?: Tab } => {
    const f = String(s["filter"] ?? "");
    return (TABS as readonly string[]).includes(f) && f !== "all" ? { filter: f as Tab } : {};
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(publicProjectsQuery),
  head: ({ loaderData }) => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/projects` },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: `${SITE}/projects/shobuj-digonto/aerial.webp` },
      { name: "twitter:image", content: `${SITE}/projects/shobuj-digonto/aerial.webp` },
    ],
    links: [{ rel: "canonical", href: `${SITE}/projects` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Natec Development residential projects",
          itemListElement: (loaderData ?? []).map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: p.name,
            url: p.kind === "upcoming" ? `${SITE}/projects` : `${SITE}/projects/${p.slug}`,
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
            { "@type": "ListItem", position: 2, name: "Projects", item: `${SITE}/projects` },
          ],
        }),
      },
    ],
  }),
  component: () => <UnderConstruction title="Projects" real={ProjectsPage} />,
  errorComponent: () => <p className="p-10 pt-32 text-center">Projects could not be loaded. Please refresh.</p>,
  notFoundComponent: () => <p className="p-10 pt-32 text-center">No projects found.</p>,
});

/** How every Natec building is delivered, from land to keys. */
const STEPS = [
  { icon: MapPinned, t: "Land & planning", b: "We secure the land at Rajendrapur and plan each building around the site, the road and the families who will live there." },
  { icon: FileCheck2, t: "Design & approvals", b: "Plans are drawn with qualified professionals and the required permits are arranged before work starts." },
  { icon: HardHat, t: "Construction", b: "RCC structure built floor by floor, with our own team supervising the work on site." },
  { icon: KeyRound, t: "Handover", b: "Finishing, final checks and handover of your flat, with the documents explained step by step." },
];
/** What every buyer gets while their home is being built. */
const PERKS = [
  { icon: Wallet, t: "Instalment plans", b: "Pay for your flat in instalments instead of one lump sum.", to: null },
  { icon: UserRound, t: "Your own client account", b: "Log in to see your payments, due dates and documents at any time.", to: "/login" as const },
  { icon: ClipboardList, t: "Live construction updates", b: "Follow each building's progress, stage by stage, with photos.", to: "/construction-status" as const },
];

function Stats({ data }: { data: ProjectWithMedia[] }) {
  const current = data.filter((p) => p.kind !== "upcoming");
  const homes = current.reduce((n, p) => n + (p.total_flats ?? 0), 0);
  const items = [
    { v: String(current.length), k: current.length === 1 ? "Project" : "Projects" },
    { v: homes ? String(homes) : "", k: "Homes" },
    { v: String(data.filter((p) => p.kind === "upcoming").length), k: "Upcoming" },
  ].filter((i) => i.v && i.v !== "0");
  return (
    <section className="border-b border-border bg-white" aria-label="Projects at a glance">
      <dl className="container-x grid grid-cols-3 divide-x divide-border">
        {items.map((i) => (
          <div key={i.k} className="flex flex-col-reverse px-2 py-6 text-center md:py-9">
            <dt className="eyebrow mt-2 !text-[11px] text-muted-foreground">{i.k}</dt>
            <dd className="num text-3xl text-navy md:text-4xl">{i.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ProjectsPage() {
  const { data } = useSuspenseQuery(publicProjectsQuery);
  const { filter = "all" } = Route.useSearch();
  const list = data.filter((p) => matchesTab(p, filter));
  const count = (t: Tab) => data.filter((p) => matchesTab(p, t)).length;
  return (
    <>
      <PageHero
        image="/projects/shobuj-digonto/aerial.webp"
        imageAlt="Aerial view of Shobuj Digonto, a Natec residential building in Rajendrapur, Sreepur, Gazipur"
        imagePosition="center 40%"
        crumbs={[{ label: "Home", to: "/" }, { label: "Projects" }]}
        eyebrow="Our projects"
        title={<>Our residential projects in <em className="accent-dark">Gazipur</em></>}
        intro="75 homes delivered or under construction — all sold."
      >
        <a href={WA_UPCOMING} target="_blank" rel="noreferrer" className="btn btn-primary"><WhatsAppIcon /> Register for upcoming projects</a>
        <a href={WA_VISIT} target="_blank" rel="noreferrer" className="btn btn-ghost-dark">Book a site visit</a>
      </PageHero>

      <Stats data={data} />

      <section className="section-pad bg-ivory">
        <div className="container-x">
          <Reveal className="mb-10 max-w-[62ch]">
            <p className="eyebrow text-brand-red">Rajendrapur, Sreepur, Gazipur</p>
            <h2 className="mt-2 text-primary">Homes built close to Rajendrapur Bazar</h2>
            <p className="mt-4 text-muted-foreground">Our buildings stand at Padma Gate and Pepsi Gate in Rajendrapur Bazar, a short way from the Dhaka–Mymensingh Highway. Every flat in our current projects has been sold. Open a project to see its photos, flat sizes and construction progress.</p>
          </Reveal>
          <div role="tablist" aria-label="Filter projects" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2">
            {TABS.map((t) => {
              const on = t === filter;
              return (
                <Link
                  key={t}
                  to="/projects"
                  search={t === "all" ? {} : { filter: t }}
                  role="tab"
                  aria-selected={on}
                  resetScroll={false}
                  className={`eyebrow shrink-0 rounded-full border px-5 py-2.5 !text-[12px] transition ${on ? "border-navy bg-navy text-white" : "border-border bg-white text-navy hover:border-navy"}`}
                >
                  {t === "all" ? "All" : t[0]!.toUpperCase() + t.slice(1)} <span className="opacity-60">({count(t)})</span>
                </Link>
              );
            })}
          </div>

          {list.length ? (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p, i) => <Reveal key={p.id} delay={(i % 3) * 100} className="h-full"><ProjectCard p={p} /></Reveal>)}
            </div>
          ) : <p className="mt-10 text-muted-foreground">No projects in this category yet.</p>}
        </div>
      </section>

      <section className="section-pad bg-white">
        <div className="container-x">
          <Reveal className="max-w-[62ch]">
            <p className="eyebrow text-brand-red">How we build</p>
            <h2 className="mt-2 text-primary">From land to keys</h2>
            <p className="mt-4 text-muted-foreground">Every Natec building goes through the same four stages, so you always know where your home stands.</p>
          </Reveal>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((st, i) => (
              <Reveal key={st.t} delay={i * 90} className="relative rounded-2xl border border-border bg-ivory p-7">
                <span className="num absolute right-6 top-6 text-sm text-navy/40">{String(i + 1).padStart(2, "0")}</span>
                <st.icon className="h-8 w-8 text-brand-red" strokeWidth={1.4} aria-hidden />
                <h3 className="mt-5 !text-xl text-navy">{st.t}</h3>
                <p className="mt-2 text-[15px] text-muted-foreground">{st.b}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-pad bg-ivory">
        <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:items-start">
          <Reveal>
            <p className="eyebrow text-brand-red">For our buyers</p>
            <h2 className="mt-2 text-primary">Buying with Natec</h2>
            <p className="mt-4 text-muted-foreground">Booking a flat while it is being built should feel clear and safe. This is what every buyer gets from day one.</p>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {PERKS.map((k, i) => {
              const body = (
                <>
                  <k.icon className="h-7 w-7 text-navy" strokeWidth={1.4} aria-hidden />
                  <h3 className="mt-4 !text-lg text-navy">{k.t}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{k.b}</p>
                  {k.to && <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-red">Open <ArrowRight className="h-4 w-4" /></span>}
                </>
              );
              return (
                <Reveal key={k.t} delay={i * 90} className="h-full">
                  {k.to
                    ? <Link to={k.to} className="block h-full rounded-2xl border border-border bg-white p-6 transition hover:border-navy hover:shadow-md">{body}</Link>
                    : <div className="h-full rounded-2xl border border-border bg-white p-6">{body}</div>}
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section-pad bg-navy text-white">
        <Reveal className="container-x flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <h2 className="max-w-[24ch]">Looking for your next home? <em className="accent-dark">Register for our upcoming projects</em></h2>
          <a href={WA_UPCOMING} target="_blank" rel="noreferrer" className="btn btn-primary shrink-0"><WhatsAppIcon /> Register on WhatsApp</a>
        </Reveal>
      </section>
    </>
  );
}
