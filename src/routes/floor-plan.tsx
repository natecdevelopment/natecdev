import { UnderConstruction } from "@/components/UnderConstruction";
import { SITE_URL } from "@/lib/site";
import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Wind, Sun, DoorOpen, CookingPot, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from "lucide-react";
import { z } from "zod";
import { PageHero, Reveal, WhatsAppIcon } from "@/components/SiteChrome";
import { waMessage } from "@/components/ProjectsGrid";
import { publicProjectsQuery } from "@/lib/projects-data";
import { supabase } from "@/integrations/supabase/client";

const SITE = SITE_URL;
const TITLE = "Apartment Floor Plans | Natec Development, Gazipur";
const DESC = "Sample Natec apartment floor plans in Rajendrapur, Sreepur, Gazipur: 3D and 2D views, bright rooms, cross-ventilation and a private balcony.";
const WA_VISIT = waMessage("Hi Natec, I'd like to book a site visit at Rajendrapur Bazar.");

export const Route = createFileRoute("/floor-plan")({
  loader: ({ context }) => context.queryClient.ensureQueryData(publicProjectsQuery),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/floor-plan` },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: `${SITE}/hero-natec/d/0060.webp` },
      { name: "twitter:image", content: `${SITE}/hero-natec/d/0060.webp` },
    ],
    links: [{ rel: "canonical", href: `${SITE}/floor-plan` }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Floor Plan", item: `${SITE}/floor-plan` },
        ],
      }),
    }],
  }),
  component: () => <UnderConstruction title="Floor Plan" real={FloorPlanPage} />,
  errorComponent: () => <p className="p-10 pt-32 text-center">This page could not be loaded. Please refresh.</p>,
  notFoundComponent: () => <p className="p-10 pt-32 text-center">Not found.</p>,
});

const VIEWS = {
  "3d": { label: "3D view", src: "/floorplan/floorplan-3d.webp", alt: "Sample 3D floor plan of a Natec apartment showing bedrooms, living, dining, kitchen and balconies" },
  "2d": { label: "2D plan", src: "/floorplan/floorplan-top.webp", alt: "Sample 2D top-down floor plan of a Natec apartment" },
} as const;
/** Room sizes as labelled on the sample plan (approx. 1,250 sq ft, 3 bed / 3 bath). */
const ROOMS = [
  { name: "Master bedroom", size: "16′ × 15′" },
  { name: "Bedroom 2", size: "12′ × 12′" },
  { name: "Bedroom 3", size: "12′ × 12′" },
  { name: "Living", size: "21′ × 18′" },
  { name: "Dining", size: "12′ × 15′" },
  { name: "Kitchen", size: "10′ × 15′" },
  { name: "Bathrooms", size: "3" },
  { name: "Balconies", size: "2 · main 13′ × 5′" },
];
const HIGHLIGHTS = [
  { icon: Wind, title: "Cross-ventilation", body: "Openings on facing walls let air move through the home." },
  { icon: Sun, title: "Natural light", body: "Windows in every main room for bright, daylit spaces." },
  { icon: DoorOpen, title: "Private balcony", body: "Every home has its own balcony." },
  { icon: CookingPot, title: "Fitted kitchen space", body: "A kitchen laid out with room for fitted counters." },
];

function PlanViewer() {
  const [view, setView] = useState<keyof typeof VIEWS>("3d");
  const box = useRef<HTMLDivElement>(null);
  const v = VIEWS[view];
  const fullscreen = () => {
    const el = box.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };
  const ctl = "rounded-full bg-white p-2.5 text-navy shadow-md hover:bg-ivory";
  return (
    <div>
      <div role="tablist" aria-label="Plan view" className="flex gap-2">
        {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((k) => (
          <button key={k} role="tab" aria-selected={k === view} onClick={() => setView(k)}
            className={`eyebrow rounded-full border px-5 py-2.5 !text-[12px] ${k === view ? "border-navy bg-navy text-white" : "border-border bg-white text-navy hover:border-navy"}`}>
            {VIEWS[k].label}
          </button>
        ))}
      </div>
      <div ref={box} className="relative mt-5 overflow-hidden rounded-2xl border border-border bg-white [&:fullscreen]:rounded-none">
        <TransformWrapper key={view} minScale={1} maxScale={5} wheel={{ step: 0.15 }} doubleClick={{ mode: "toggle", step: 1.2 }}>
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full" wrapperStyle={{ touchAction: "none" }}>
                <img src={v.src} alt={v.alt} width={1600} height={1000} className="aspect-[16/10] h-full w-full object-contain" draggable={false} />
              </TransformComponent>
              <div className="absolute bottom-3 right-3 flex gap-2">
                <button onClick={() => zoomIn()} aria-label="Zoom in" className={ctl}><ZoomIn className="h-4 w-4" /></button>
                <button onClick={() => zoomOut()} aria-label="Zoom out" className={ctl}><ZoomOut className="h-4 w-4" /></button>
                <button onClick={() => resetTransform()} aria-label="Reset zoom" className={ctl}><RotateCcw className="h-4 w-4" /></button>
                <button onClick={fullscreen} aria-label="Full screen" className={ctl}><Maximize2 className="h-4 w-4" /></button>
              </div>
            </>
          )}
        </TransformWrapper>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Sample layout for illustration. Sizes and layouts differ by project.</p>
      <p className="mt-1 text-xs text-muted-foreground">Scroll or pinch to zoom, drag to move.</p>
    </div>
  );
}

const schema = z.object({
  project: z.string().trim().min(1, "Please choose a project"),
  full_name: z.string().trim().min(1, "Please enter your name").max(120),
  phone: z.string().trim().min(5, "Please enter a valid phone number").max(30),
});
const field = "w-full rounded-xl border border-input bg-white px-4 py-3 text-[15px] text-foreground outline-none focus:border-navy focus:ring-2 focus:ring-navy/15";

function RequestCard() {
  const { data } = useSuspenseQuery(publicProjectsQuery);
  const [project, setProject] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const parsed = schema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Please check the form"); setStatus("error"); return; }
    setStatus("sending");
    const d = parsed.data;
    const { error } = await supabase.from("contact_submissions").insert({
      full_name: d.full_name, phone: d.phone, service: d.project, message: `Floor plan request: ${d.project}`,
    });
    if (error) { setError("Something went wrong. Please try again or call us."); setStatus("error"); return; }
    form.reset(); setProject(""); setStatus("done");
  }
  const wa = waMessage(project ? `Hi Natec, please send me the floor plan for ${project}.` : "Hi Natec, please send me a floor plan for your projects.");
  return (
    <form id="request" onSubmit={onSubmit} className="scroll-mt-28 space-y-4 rounded-2xl bg-white p-6 shadow-2xl md:p-9">
      <h2 className="!text-3xl text-navy">Request the floor plan for a project</h2>
      <select name="project" aria-label="Project" className={field} value={project} onChange={(e) => setProject(e.target.value)}>
        <option value="">Choose a project *</option>
        {data.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
      </select>
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="full_name" aria-label="Full name" placeholder="Full name *" className={field} maxLength={120} />
        <input name="phone" aria-label="Phone number" placeholder="Phone number *" className={field} maxLength={30} />
      </div>
      {status === "error" && <p className="text-sm text-brand-red">{error}</p>}
      {status === "done" && <p className="text-sm font-semibold text-navy">Thank you — we'll send you the floor plan soon.</p>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button disabled={status === "sending"} className="btn btn-primary flex-1 disabled:opacity-60">{status === "sending" ? "Sending…" : "Request floor plan"}</button>
        <a href={wa} target="_blank" rel="noreferrer" className="btn flex-1 border border-navy text-navy"><WhatsAppIcon /> Ask on WhatsApp</a>
      </div>
    </form>
  );
}

function FloorPlanPage() {
  return (
    <>
      <PageHero
        image="/hero-natec/d/0060.webp"
        imageAlt="Living room of a sample Natec apartment"
        imagePosition="center 45%"
        crumbs={[{ label: "Home", to: "/" }, { label: "Floor Plan" }]}
        eyebrow="Floor plans"
        title={<>Floor plans designed around <em className="accent-dark">family life</em></>}
        intro="Bright rooms, cross-ventilation and a private balcony in every home."
      >
        <a href="#request" className="btn btn-primary">Request a floor plan</a>
        <a href={WA_VISIT} target="_blank" rel="noreferrer" className="btn btn-ghost-dark">Book a site visit</a>
      </PageHero>

      <section className="section-pad bg-ivory">
        <div className="container-x">
          <Reveal className="max-w-[62ch]">
            <p className="eyebrow text-brand-red">Sample plan</p>
            <h2 className="mt-2 text-primary">A typical three-bedroom home</h2>
            <p className="mt-4 text-muted-foreground">The plans shown here are samples. Actual layouts vary by project — ask us for the plan of a specific project and we'll share it with you.</p>
          </Reveal>
          <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Reveal className="min-w-0"><PlanViewer /></Reveal>
            <Reveal delay={120}>
              <h3 className="!text-xl text-navy">Rooms</h3>
              <dl className="mt-4 divide-y divide-border rounded-2xl border border-border bg-white">
                {ROOMS.map((r) => (
                  <div key={r.name} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <dt className="font-medium text-navy">{r.name}</dt>
                    <dd className="num whitespace-nowrap text-sm text-muted-foreground">{r.size}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">Sizes from the sample plan, approx. 1,250 sq ft in total. Each project's plan may differ.</p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="bg-white py-14 md:py-20" aria-label="Highlights">
        <div className="container-x grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map((h, i) => (
            <Reveal key={h.title} delay={i * 90} className="flex gap-4">
              <h.icon className="h-7 w-7 shrink-0 text-brand-red" aria-hidden />
              <div><h3 className="!text-lg text-navy">{h.title}</h3><p className="mt-1 text-sm text-muted-foreground">{h.body}</p></div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section-pad bg-navy">
        <div className="container-x mx-auto max-w-3xl"><RequestCard /></div>
      </section>
    </>
  );
}
