import { useRef, useState } from "react";
import { SITE_URL } from "@/lib/site";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Phone } from "lucide-react";
import { UnderConstruction } from "@/components/UnderConstruction";
import { PageHero, Reveal, WhatsAppIcon } from "@/components/SiteChrome";
import { publicProjectsQuery, type ProjectWithMedia } from "@/lib/projects-data";
import { isListed, monthYear } from "@/lib/construction-data";
import { company } from "@/lib/site";

const SITE = SITE_URL;
const TITLE = "Construction Status | Natec Development Ltd., Gazipur";
const DESC = "Live construction progress of Natec Development's residential projects in Rajendrapur, Sreepur, Gazipur — work-by-work updates and site photos.";

export const Route = createFileRoute("/construction-status")({
  loader: ({ context }) => context.queryClient.ensureQueryData(publicProjectsQuery),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/construction-status` },
      { property: "og:image", content: `${SITE}/hero-natec/d/0024.webp` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${SITE}/hero-natec/d/0024.webp` },
    ],
    links: [{ rel: "canonical", href: `${SITE}/construction-status` }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Construction Status", item: `${SITE}/construction-status` },
        ],
      }),
    }],
  }),
  component: () => <UnderConstruction title="Construction Status" real={StatusIndex} />,
  pendingComponent: () => <div className="container-x space-y-4 pt-40">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>,
  errorComponent: () => <p className="p-10 pt-32 text-center">Construction status could not be loaded. Please refresh.</p>,
  notFoundComponent: () => <p className="p-10 pt-32 text-center">Not found.</p>,
});

function StatusIndex() {
  const { data } = useSuspenseQuery(publicProjectsQuery);
  const list = data.filter(isListed);
  const [hover, setHover] = useState<ProjectWithMedia | null>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const box = listRef.current?.getBoundingClientRect();
    if (!box || !thumb.current) return;
    thumb.current.style.transform = `translate3d(${e.clientX - box.left - 140}px, ${e.clientY - box.top - 100}px, 0)`;
  };

  return (
    <>
      <PageHero
        image="/hero-natec/d/0024.webp"
        imageAlt="Natec Development construction site in Rajendrapur, Sreepur, Gazipur"
        imagePosition="center 55%"
        crumbs={[{ label: "Home", to: "/" }, { label: "Construction Status" }]}
        eyebrow="Construction status"
        title="See how your home is coming along"
        intro="Work-by-work progress and monthly site photos for every Natec project."
        heightClass="min-h-[64svh] md:min-h-[66svh]"
      />

      <section className="section-pad overflow-x-clip bg-ivory">
        <div className="container-x">
          {list.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">Construction updates will appear here soon.</p>
          ) : (
            <div ref={listRef} className="relative" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
              <ul className="border-t border-navy/15">
                {list.map((p, i) => (
                  <Reveal key={p.id} delay={i * 80}>
                    <li className="border-b border-navy/15">
                      <Link
                        to="/construction-status/$slug"
                        params={{ slug: p.slug }}
                        onMouseEnter={() => setHover(p)}
                        onFocus={() => setHover(null)}
                        className="group flex min-h-[72px] items-center gap-4 py-5 md:gap-8 md:py-9"
                      >
                        <span className="font-label w-10 shrink-0 text-xs tracking-[0.2em] text-brand-red md:w-16 md:text-sm">{p.project_no.replace(/^Project\s*/i, "") || String(i + 1).padStart(2, "0")}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-display text-[1.9rem] leading-[1.05] text-navy/85 transition-colors duration-300 group-hover:text-navy sm:text-5xl md:text-6xl lg:text-7xl">{p.name}</span>
                          <span className="mt-2 block text-sm text-muted-foreground">{p.status_updated_at ? `Updated ${monthYear(p.status_updated_at)}` : "Updates coming soon"} · {p.progress_pct}% complete</span>
                        </span>
                        {p.cover && (
                          <img src={p.cover.public_url} alt="" aria-hidden loading="lazy" width={64} height={64} className="h-14 w-14 shrink-0 rounded-lg object-cover md:hidden" />
                        )}
                        <ArrowRight className="hidden h-8 w-8 shrink-0 text-navy/40 transition duration-300 group-hover:translate-x-2 group-hover:text-brand-red md:block" aria-hidden />
                      </Link>
                    </li>
                  </Reveal>
                ))}
              </ul>
              <div ref={thumb} aria-hidden className="pointer-events-none absolute left-0 top-0 hidden md:block">
                <div className={`ml-[-40px] h-[200px] w-[280px] overflow-hidden rounded-2xl shadow-2xl transition-opacity duration-300 ${hover?.cover ? "opacity-100" : "opacity-0"}`}>
                  {hover?.cover && <img src={hover.cover.public_url} alt="" className="h-full w-full object-cover" />}
                </div>
              </div>
            </div>
          )}

          <div className="mt-14 flex flex-col items-start gap-5 rounded-2xl bg-white p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <p className="max-w-[52ch] text-navy">Updates are posted by our site team. For a site visit, contact us.</p>
            <div className="flex flex-wrap gap-3">
              <a href={company.whatsappLink} target="_blank" rel="noreferrer" className="btn btn-primary"><WhatsAppIcon /> WhatsApp</a>
              <a href={company.phoneLink} className="btn border border-navy text-navy"><Phone className="h-4 w-4" /> Call</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
