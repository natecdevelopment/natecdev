import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ProjectFacts } from "@/components/ProjectFacts";
import { Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, Building2, Trees, Wallet, ClipboardList, HardHat, Play, MessageCircle, LayoutGrid, FileText, Phone, Mail, BedDouble, Bath, Sofa, UtensilsCrossed, CookingPot, Fence, Ruler, Facebook } from "lucide-react";
import { company, directors } from "@/lib/site";
import { PersonFemaleIcon, PersonMaleIcon } from "@/components/PersonIcons";
import { Reveal, WhatsAppIcon } from "@/components/SiteChrome";
import { InquiryForm } from "@/components/InquiryForm";
import { frameSrc } from "@/components/CinematicHero";
import { useSuspenseQuery } from "@tanstack/react-query";
import { publicVideosQuery, type VideoRow } from "@/lib/projects-data";
import { youtubeThumb } from "@/lib/video";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AvailabilityBadge, ProjectCta, UpcomingCards, usePublicProjects } from "@/components/ProjectsGrid";
import { VintageKeyIcon } from "@/components/VintageKeyIcon";
import homeSketch from "@/assets/home-sketch.png";

function Eyebrow({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return <p className={`eyebrow ${dark ? "text-muted-dark" : "text-brand-red"}`}>{children}</p>;
}

/* ---------- 1. Intro + numbers ---------- */
function CountUp({ to, suffix = "" }: { to: number; suffix?: string | undefined }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = to > 1000 ? to - 40 : 0;
    el.textContent = `${reduce ? to : start}${suffix}`;
    if (reduce) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 1400);
        el.textContent = `${Math.round(start + (to - start) * (1 - Math.pow(1 - k, 3)))}${suffix}`;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [to, suffix]);
  return <span ref={ref}>{to}{suffix}</span>;
}

export function Intro() {
  const stats = [
    { n: 2023, l: "Established" },
    { n: 75, l: "Homes delivered & under construction" },
    { n: 3, l: "Projects" },
    { n: 100, s: "%", l: "Sold" },
  ];
  return (
    <section className="section-pad bg-ivory">
      <div className="container-x">
        <Reveal className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:gap-16">
          <div>
            <h2 className="text-navy">
              A real estate developer <em className="accent-light">rooted in Rajendrapur, Sreepur, Gazipur.</em>
            </h2>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-5 md:mt-11">
              <img src={homeSketch} alt="Hand-drawn sketch of a modern family home surrounded by trees" loading="lazy" width={973} height={509} className="w-[168px] shrink-0 md:w-[232px]" />
              <div className="min-w-0 md:border-l md:border-border md:pl-6">
                <p className="font-label text-[10px] font-medium uppercase leading-[1.9] tracking-[0.3em] text-navy md:text-[11px]">
                  Building trust,<br /> generation after generation
                </p>
                <VintageKeyIcon className="mt-3 h-[15px] w-[30px] text-brand-red" />
              </div>
            </div>
          </div>
          <div className="max-w-[62ch] space-y-4 text-muted-foreground">
            <Eyebrow>About Natec</Eyebrow>
            <p>Natec Development Ltd. is a real estate developer in Gazipur and a young apartment developer in Bangladesh, established in 2023 and based at Rajendrapur Bazar, Sreepur. Our three residential buildings — Shobuj Angon, Shobuj Aloy and Shobuj Digonto — add up to 75 flats in Sreepur, and every one of them is sold.</p>
            <p>We handle the whole journey: land acquisition, project planning, financing guidance, permits and approvals, building design, construction management, marketing and sales, and property management. Two upcoming projects in Gazipur are next.</p>
            <p lang="bn" className="font-display text-lg text-navy">রাজেন্দ্রপুর, শ্রীপুর, গাজীপুরে পরিকল্পিত আবাসন</p>
            <Link to="/about" className="inline-flex items-center gap-2 font-semibold text-navy hover:text-brand-red">More about us <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </Reveal>
        <Reveal className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border md:mt-20 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l} className="bg-ivory p-6 md:p-8">
              <div className="num text-5xl text-navy md:text-6xl"><CountUp to={s.n} suffix={s.s} /></div>
              <div className="eyebrow mt-2 !text-[11px] text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- 2. Projects ---------- */
export function ProjectsShowcase() {
  const { current, upcoming } = usePublicProjects();
  const flats = current.reduce((n, p) => n + (p.total_flats ?? 0), 0);
  const allSold = current.length > 0 && current.every((p) => p.availability === "Sold out");
  return (
    <section className="section-pad bg-navy-deep text-white">
      <div className="container-x">
        <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow dark>Our projects</Eyebrow>
            <h2 className="mt-3">Our residential projects <em className="accent-dark">in Gazipur.</em></h2>
            {flats > 0 && <p className="mt-4 text-lg text-muted-dark">{flats} homes delivered or under construction{allSold ? " — all sold." : "."}</p>}
          </div>
          <Link to="/projects" className="btn btn-ghost-dark">All projects</Link>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {current.map((p) => (
            <Reveal key={p.id}>
              <div className="group relative block overflow-hidden rounded-2xl">
                <img src={p.cover?.public_url} alt={p.cover?.alt_text || `${p.name} by Natec Development`} title={p.cover?.title || undefined} loading="lazy" width={p.cover?.width ?? 1200} height={p.cover?.height ?? 900} className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(4,26,56,0.92) 0%, rgba(4,26,56,0.35) 45%, transparent 70%)" }} />
                <span className={`eyebrow absolute left-5 top-5 rounded-full px-3 py-1.5 !text-[10px] ${p.status === "Completed" ? "bg-success text-white" : "bg-white text-navy"}`}>{p.status}</span>
                <AvailabilityBadge text={p.availability} className="absolute right-5 top-5" />
                <ProjectFacts p={p} tone="glass" className="absolute inset-x-5 top-[64px]" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <p className="eyebrow !text-[10px] text-white/70">{p.project_no}</p>
                  <h3 className="!text-3xl"><Link to="/projects/$slug" params={{ slug: p.slug }} className="hover:underline">{p.name}</Link></h3>
                  <p className="mt-1 text-sm text-muted-dark">{p.address}</p>
                  {p.building_type && <p className="text-sm text-muted-dark">Residential building, {p.building_type}</p>}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs"><span className="eyebrow !text-[10px]">Construction</span><span className="num">{p.progress_pct}%</span></div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-brand-red" style={{ width: `${p.progress_pct}%` }} /></div>
                  </div>
                  <ProjectCta p={p} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline" />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        {upcoming.length > 0 && <h3 className="eyebrow mb-2 mt-16 !text-[13px] text-muted-dark">Upcoming projects in Gazipur</h3>}
        {upcoming.length > 0 && <p className="mb-6 text-muted-dark">Current buildings are sold out — register now for the next apartments in Gazipur.</p>}
        <UpcomingCards dark />
      </div>
    </section>
  );
}

/* ---------- 3. Floor plan ---------- */
const SPECS = [
  { i: Ruler, t: "Approx. 1,250 sq ft" },
  { i: BedDouble, t: "3 bedrooms" },
  { i: Bath, t: "3 bathrooms" },
  { i: Sofa, t: "Living room" },
  { i: UtensilsCrossed, t: "Dining area" },
  { i: CookingPot, t: "Fitted kitchen" },
  { i: Fence, t: "2 balconies" },
];

export function FloorPlan() {
  const [tab, setTab] = useState<"3d" | "top">("3d");
  return (
    <section className="section-pad bg-ivory">
      <div className="container-x grid items-center gap-12 md:grid-cols-[1.4fr_1fr]">
        <Reveal>
          <div className="mb-5 inline-flex rounded-full border border-input p-1">
            {(["3d", "top"] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={`eyebrow rounded-full px-5 py-2 !text-[11px] transition ${tab === k ? "bg-navy text-white" : "text-navy"}`}>
                {k === "3d" ? "3D view" : "Plan"}
              </button>
            ))}
          </div>
          <img src={`/floorplan/floorplan-${tab}.webp`} alt={tab === "3d" ? "3D floor plan of a sample Natec home" : "Top-down floor plan of a sample Natec home"} loading="lazy" width={1600} height={1200} className="w-full rounded-2xl bg-white object-contain shadow-xl" />
        </Reveal>
        <Reveal>
          <Eyebrow>Floor plan</Eyebrow>
          <h2 className="mt-3 text-navy">A home planned around <em className="accent-light">family life.</em></h2>
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {SPECS.map(({ i: I, t }) => (
              <li key={t} className="flex items-center gap-4 py-3.5 text-foreground"><I className="h-5 w-5 text-navy" strokeWidth={1.4} /> {t}</li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-muted-foreground">Sample layout — actual plans vary by project.</p>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- 4. Why Natec ---------- */
const WHY = [
  { i: MapPin, t: "Prime Rajendrapur location", b: "Our buildings sit close to Rajendrapur Bazar, Sreepur, Gazipur." },
  { i: Building2, t: "Planned RCC buildings", b: "Each residential building is planned as a reinforced-concrete structure." },
  { i: Wallet, t: "Clear instalment plans", b: "Pay in instalments and see every payment and due date in your client account." },
  { i: Trees, t: "Rooftop spaces", b: "Open rooftops for fresh air and family time." },
  { i: ClipboardList, t: "Progress you can follow", b: "Each building's progress is posted on our Construction Status page." },
  { i: HardHat, t: "On-site supervision", b: "Our team oversees the work on site, floor by floor." },
];

export function WhyNatec() {
  const Tile = ({ w, className = "" }: { w: (typeof WHY)[number]; className?: string }) => (
    <Reveal className={`relative rounded-2xl border border-border bg-white p-7 ${className}`}>
      <span className="absolute right-6 top-6 h-2 w-2 rounded-full bg-brand-red" />
      <w.i className="h-8 w-8 text-navy" strokeWidth={1.2} />
      <h3 className="mt-6 text-navy">{w.t}</h3>
      <p className="mt-2 text-[15px] text-muted-foreground">{w.b}</p>
    </Reveal>
  );
  return (
    <section className="section-pad bg-ivory">
      <div className="container-x">
        <Reveal className="mb-12 max-w-2xl">
          <Eyebrow>Why Natec</Eyebrow>
          <h2 className="mt-3 text-navy">Why families <em className="accent-light">choose Natec.</em></h2>
        </Reveal>
        <div className="grid gap-5 md:grid-cols-3">
          <Reveal className="relative min-h-[420px] overflow-hidden rounded-2xl md:row-span-2">
            <img src={frameSrc("d", 32)} alt="Open rooftop space on a Natec residential building in Rajendrapur, Sreepur, Gazipur" loading="lazy" width={1920} height={1080} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(4,26,56,0.85), transparent 60%)" }} />
            <div className="absolute inset-x-0 bottom-0 p-7 text-white">
              <span className="mb-4 block h-2 w-2 rounded-full bg-brand-red" />
              <h3>{WHY[3]!.t}</h3>
              <p className="mt-2 text-[15px] text-white/85">{WHY[3]!.b}</p>
            </div>
          </Reveal>
          {WHY.filter((_, i) => i !== 3).map((w) => <Tile key={w.t} w={w} />)}
        </div>
      </div>
    </section>
  );
}

/* ---------- 5. How we build ---------- */
const STEPS = [
  { t: "Excavation", b: "Soil testing, survey and a clean, level site." },
  { t: "Foundation", b: "Deep piles and a reinforced raft, inspected before pour." },
  { t: "Structure", b: "RCC columns and slabs, floor by floor." },
  { t: "Facade", b: "Brickwork, plaster, windows and exterior finish." },
  { t: "Handover", b: "Final checks, documents and your keys." },
];

export function HowWeBuild() {
  const ref = useRef<HTMLOListElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = () => {
      const el = ref.current, f = fill.current;
      if (!el || !f) return;
      const r = el.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (window.innerHeight * 0.7 - r.top) / r.height));
      f.style.transform = window.innerWidth >= 768 ? `scaleX(${p})` : `scaleY(${p})`;
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);
  return (
    <section className="section-pad bg-navy text-white">
      <div className="container-x">
        <Reveal className="mb-14 max-w-2xl">
          <Eyebrow dark>How we build</Eyebrow>
          <h2 className="mt-3">How we build, <em className="accent-dark">step by step.</em></h2>
        </Reveal>
        <ol ref={ref} className="relative grid gap-10 pl-10 md:grid-cols-5 md:gap-6 md:pl-0 md:pt-12">
          <div aria-hidden className="absolute bottom-0 left-[11px] top-0 w-px bg-line-dark md:left-0 md:right-0 md:top-[11px] md:h-px md:w-auto" />
          <div ref={fill} aria-hidden className="absolute bottom-0 left-[11px] top-0 w-px origin-top bg-brand-red md:left-0 md:right-0 md:top-[11px] md:h-[2px] md:w-auto md:origin-left" style={{ transform: "scaleY(0)" }} />
          {STEPS.map((s, i) => (
            <li key={s.t} className="relative">
              <span className="absolute -left-10 top-0 flex h-[23px] w-[23px] items-center justify-center rounded-full border border-white/40 bg-navy md:-top-12 md:left-0"><span className="h-2 w-2 rounded-full bg-brand-red" /></span>
              <span className="num text-sm text-muted-dark">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-1">{s.t}</h3>
              <p className="mt-2 text-[15px] text-muted-dark">{s.b}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- 6. Location ---------- */
const NEARBY = [
  { t: "Rajendrapur Bazar", d: "Our projects & office" },
  { t: "Dhaka–Mymensingh Highway", d: "At Rajendrapur Chowrasta" },
  { t: "Dhaka city", d: "≈ 36 km by road" },
  { t: "Schools & colleges", d: "In the area" },
  { t: "Bhawal National Park", d: "Short drive" },
];

export function Location() {
  return (
    <section className="section-pad bg-white">
      <div className="container-x grid gap-10 md:grid-cols-[1fr_1.4fr]">
        <Reveal>
          <Eyebrow>Location</Eyebrow>
          <h2 className="mt-3 text-navy">Close to everything <em className="accent-light">that matters.</em></h2>
          <p className="mt-4 max-w-[62ch] text-muted-foreground">{company.address}</p>
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {NEARBY.map((n) => (
              <li key={n.t} className="flex items-center justify-between py-3.5"><span className="flex items-center gap-3"><MapPin className="h-4 w-4 text-brand-red" strokeWidth={1.6} />{n.t}</span><span className="num text-navy">{n.d}</span></li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Distances are approximate. <Link to="/location" className="underline decoration-brand-red underline-offset-2 hover:text-navy">Directions and more nearby places</Link></p>
        </Reveal>
        <Reveal className="overflow-hidden rounded-2xl shadow-xl">
          <iframe title="Natec Development office location" src="https://www.google.com/maps?q=Rajendrapur+Bazar,+Sreepur,+Gazipur,+Bangladesh&output=embed" className="block h-[380px] w-full border-0 md:h-full md:min-h-[480px]" loading="lazy" />
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- 7. Board ---------- */
export function Board() {
  return (
    <section className="section-pad bg-ivory">
      <div className="container-x">
        <Reveal className="mb-12 max-w-2xl">
          <Eyebrow>Board of directors</Eyebrow>
          <h2 className="mt-3 text-navy">The people <em className="accent-light">behind every floor.</em></h2>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {directors.map((d) => (
            <Reveal key={d.name} className="flex flex-col rounded-2xl border border-border bg-white p-7">
              <div className="flex aspect-square w-20 items-center justify-center rounded-full bg-navy text-white">
                {d.gender === "female" ? <PersonFemaleIcon className="h-10 w-10" /> : <PersonMaleIcon className="h-10 w-10" />}
              </div>
              <h3 className="mt-5 text-navy">{d.name}</h3>
              <p className="eyebrow mt-1 !text-[11px] text-brand-red">{d.role}</p>
              <div className="mt-5 space-y-1.5 border-t border-border pt-4 text-sm">
                <a href={`mailto:${d.email}`} className="flex items-center gap-2 break-all text-foreground hover:text-brand-red"><Mail className="h-4 w-4 shrink-0 text-navy" />{d.email}</a>
                <a href={`tel:${d.phone.replace(/[^+\d]/g, "")}`} className="flex items-center gap-2 text-foreground hover:text-brand-red"><Phone className="h-4 w-4 shrink-0 text-navy" />{d.phone}</a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 8. CTA + contact ---------- */
export function ContactCTA() {
  return (
    <section className="relative overflow-hidden text-white">
      <img src={frameSrc("d", 118)} alt="" aria-hidden loading="lazy" width={1920} height={1080} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-navy-deep/65" />
      <div className="section-pad relative">
        <div className="container-x grid items-center gap-12 md:grid-cols-[1fr_1.15fr]">
          <Reveal>
            <Eyebrow dark>Contact</Eyebrow>
            <h2 className="mt-3">Visit the site. <em className="accent-dark">Meet the team.</em></h2>
            <div className="mt-8 space-y-4">
              <a href={company.whatsappLink} target="_blank" rel="noreferrer" className="btn btn-primary"><WhatsAppIcon /> {company.whatsapp}</a>
              <a href={company.phoneLink} className="flex items-center gap-3 text-white/90 hover:text-white"><Phone className="h-5 w-5" /> {company.phone}</a>
              <a href={`mailto:${company.email}`} className="flex items-center gap-3 text-white/90 hover:text-white"><Mail className="h-5 w-5" /> {company.email}</a>
              <p className="flex max-w-md gap-3 text-white/90"><MapPin className="h-5 w-5 shrink-0" /> {company.address}</p>
            </div>
          </Reveal>
          <Reveal><InquiryForm /></Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------- Videos ---------- */
function thumbOf(v: VideoRow) {
  return v.thumbnail_url || (v.provider === "youtube" ? youtubeThumb(v.video_id) : null);
}
function embedOf(v: VideoRow) {
  return v.provider === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${v.video_id}?autoplay=1&rel=0`
    : `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(v.url)}&show_text=false&autoplay=true`;
}

function VideoPoster({ v, small }: { v: VideoRow; small?: boolean }) {
  const t = thumbOf(v);
  const [state, setState] = useState<"load" | "ok" | "fail">(t ? "load" : "fail");
  useEffect(() => {
    if (state !== "load") return;
    const id = setTimeout(() => setState((s) => (s === "load" ? "fail" : s)), 6000);
    return () => clearTimeout(id);
  }, [state]);
  if (!t || state === "fail") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-navy p-3 text-center text-white">
        <img src="/brand/natec-mark.png" alt="" aria-hidden width={44} height={44} loading="lazy" className={small ? "h-6 w-auto" : "h-12 w-auto"} />
        {small && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-red"><Play className="ml-0.5 h-2.5 w-2.5 fill-current" /></span>}
        {!small && <span className="font-display text-lg">{v.title}</span>}
      </div>
    );
  }
  return (
    <img src={t} alt={`${v.title || "Natec project video"} — video thumbnail`} loading="lazy" width={480} height={270}
      onLoad={() => setState("ok")} onError={() => setState("fail")} ref={(el) => { if (el?.complete && el.naturalWidth) setState("ok"); }}
      className="absolute inset-0 h-full w-full object-cover" />
  );
}

/** Lite embed: poster + red play button; the iframe loads only after a click. */
function LiteVideo({ v, autoplay = false }: { v: VideoRow; autoplay?: boolean }) {
  const [on, setOn] = useState(autoplay);
  useEffect(() => setOn(autoplay), [v.id, autoplay]);
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-navy-deep">
      {on ? (
        <iframe src={embedOf(v)} title={v.title || "Natec project video"} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="absolute inset-0 h-full w-full border-0" />
      ) : (
        <button type="button" onClick={() => setOn(true)} className="group absolute inset-0" aria-label={`Play video: ${v.title || "Natec project video"}`}>
          <VideoPoster v={v} />
          <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand-red md:h-16 md:w-16 text-white shadow-xl transition group-hover:scale-110">
            <Play className="ml-1 h-7 w-7 fill-current" />
          </span>
        </button>
      )}
    </div>
  );
}

export function VideosSection() {
  const { data } = useSuspenseQuery(publicVideosQuery);
  const [active, setActive] = useState(0);
  const [played, setPlayed] = useState(false);
  const [slide, setSlide] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [focusIdx, setFocusIdx] = useState(-1);
  if (!data?.length) return null;
  const reveal = (i: number) => (listRef.current?.children[i] as HTMLElement | undefined)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  const pick = (i: number) => { setActive(i); setPlayed(true); setFocusIdx(i); reveal(i); };
  const onListKey = (e: ReactKeyboardEvent) => {
    const cur = focusIdx < 0 ? active : focusIdx;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = Math.max(0, Math.min(data.length - 1, cur + (e.key === "ArrowDown" ? 1 : -1)));
      setFocusIdx(n); reveal(n);
    } else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(cur); }
  };
  const featured = data[Math.min(active, data.length - 1)]!;
  const goto = (i: number) => {
    const el = track.current?.children[i] as HTMLElement | undefined;
    const box = track.current;
    if (el && box) box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  };
  const onTrackScroll = (box: HTMLDivElement) => {
    const mid = box.scrollLeft + box.clientWidth / 2;
    let best = 0, dist = Infinity;
    Array.from(box.children).forEach((c, i) => { const el = c as HTMLElement; const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid); if (d < dist) { dist = d; best = i; } });
    setSlide(best);
  };
  const fbBtn = "self-center mt-5 inline-flex h-10 items-center gap-2 rounded-full border-[1.5px] border-navy px-[18px] font-label text-[12px] uppercase tracking-[0.12em] text-navy";
  return (
    <section className="bg-white py-14 md:py-[120px]" aria-labelledby="videos-h">
      <div className="container-x">
        <Reveal className="mb-6 flex flex-col items-center gap-6 text-center md:mb-10 md:flex-row md:flex-wrap md:items-end md:justify-between md:text-left">
          <div>
            <Eyebrow>Site videos</Eyebrow>
            <h2 id="videos-h" className="mx-auto mt-3 max-w-[320px] text-[clamp(1.75rem,8vw,2.2rem)] leading-[1.15] text-navy md:mx-0 md:max-w-none md:text-[clamp(1.9rem,3.6vw,3.1rem)] md:leading-[1.1]">See our projects <br className="md:hidden" /><em className="accent-light">on video.</em></h2>
          </div>
          <a href={company.facebook} target="_blank" rel="noreferrer" className="btn btn-ghost-light hidden md:inline-flex">More on Facebook</a>
        </Reveal>

        {/* Desktop: featured + list */}
        <div className="hidden gap-6 md:grid md:grid-cols-[1.7fr_1fr]">
          <div>
            <LiteVideo v={featured} autoplay={played} />
            {featured.title && <p className="mt-3 font-display text-xl text-navy">{featured.title}</p>}
          </div>
          {data.length > 1 && (
            <ul
              ref={listRef}
              data-lenis-prevent
              tabIndex={0}
              aria-label="Site videos"
              onKeyDown={onListKey}
              className="video-list max-h-[440px] space-y-3 overflow-y-auto py-3 pr-1 outline-none focus-visible:ring-2 focus-visible:ring-navy/40 rounded-xl"
            >
              {data.map((v, i) => (
                <li key={v.id}>
                  <button type="button" tabIndex={-1} onClick={() => pick(i)} aria-current={i === active} className={`flex w-full items-center gap-3 rounded-xl border-l-4 p-2 text-left transition ${i === active ? "border-brand-red bg-ivory" : "border-transparent hover:bg-ivory"} ${i === focusIdx ? "ring-1 ring-navy/30" : ""}`}>
                    <span className="relative block aspect-video w-32 shrink-0 overflow-hidden rounded-lg"><VideoPoster v={v} small /></span>
                    <span className="line-clamp-2 text-sm font-medium text-navy">{v.title || "Natec project video"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Mobile: centred swipe carousel */}
        <div className="flex flex-col md:hidden">
          {data.length === 1 ? (
            <div>
              <LiteVideo v={data[0]!} />
              {data[0]!.title && <p className="mt-2.5 line-clamp-2 text-center text-[15px] font-medium text-navy">{data[0]!.title}</p>}
            </div>
          ) : (
            <>
              <div
                ref={track}
                onScroll={(e) => onTrackScroll(e.currentTarget)}
                className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-[7vw] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-roledescription="carousel"
              >
                {data.map((v, i) => (
                  <div key={v.id} className="w-[86vw] max-w-[420px] shrink-0 snap-center" aria-label={`${i + 1} / ${data.length}`}>
                    <LiteVideo v={v} />
                    {v.title && <p className="mt-2.5 line-clamp-2 text-center text-[15px] font-medium leading-snug text-navy">{v.title}</p>}
                  </div>
                ))}
              </div>
              <p className="sr-only" aria-live="polite">{slide + 1} / {data.length}</p>
              <div className="mt-2 flex justify-center">
                {data.map((v, i) => (
                  <button key={v.id} type="button" onClick={() => goto(i)} aria-label={`Show video ${i + 1}`} aria-current={i === slide} className="flex h-11 w-8 items-center justify-center">
                    <span className={`h-2 rounded-full transition-all ${i === slide ? "w-6 bg-brand-red" : "w-2 bg-navy/25"}`} />
                  </button>
                ))}
              </div>
            </>
          )}
          <a href={company.facebook} target="_blank" rel="noreferrer" className={fbBtn}><Facebook className="h-4 w-4" aria-hidden /> More on Facebook</a>
        </div>
      </div>
    </section>
  );
}

/* ---------- Buying with Natec ---------- */
const BUY = [
  { i: MessageCircle, t: "Talk to us", b: "Message us on WhatsApp or call the office." },
  { i: MapPin, t: "Visit the site", b: "See the building and the neighbourhood in Rajendrapur Bazar." },
  { i: LayoutGrid, t: "Choose your flat", b: "Pick the floor and layout that suits your family." },
  { i: FileText, t: "Booking and documents", b: "We guide you through booking and the paperwork." },
];
export const WA_SITE_VISIT = `${company.whatsappLink}?text=${encodeURIComponent("Hi Natec, I'd like to book a site visit.")}`;

export function BuyingSteps() {
  return (
    <section className="section-pad bg-white">
      <div className="container-x">
        <Reveal className="mb-12 max-w-2xl">
          <Eyebrow>Buying with Natec</Eyebrow>
          <h2 className="mt-3 text-navy">Buying your flat in Rajendrapur, <em className="accent-light">in four steps.</em></h2>
        </Reveal>
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BUY.map((s, n) => (
            <li key={s.t} className="list-none">
              <Reveal className="h-full rounded-2xl border border-border bg-ivory p-7">
                <div className="flex items-center justify-between">
                  <s.i className="h-7 w-7 text-navy" strokeWidth={1.3} />
                  <span className="num text-3xl text-brand-red">{n + 1}</span>
                </div>
                <h3 className="mt-5 text-navy">{s.t}</h3>
                <p className="mt-2 text-[15px] text-muted-foreground">{s.b}</p>
              </Reveal>
            </li>
          ))}
        </ol>
        <a href={WA_SITE_VISIT} target="_blank" rel="noreferrer" className="btn btn-primary mt-10"><WhatsAppIcon /> Book a site visit</a>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */
export const FAQS = [
  { q: "Where are Natec's projects located?", a: "Our projects are in Rajendrapur Bazar, Sreepur, Gazipur: Shobuj Angon and Shobuj Aloy at Padma Gate, and Shobuj Digonto at Pepsi Gate. Our two upcoming projects are in Rajendrapur Bazar and Gazipur." },
  { q: "Are there flats available now?", a: "There are no ready flats left right now — all 75 flats in our three current projects are sold out. Register your interest for our upcoming projects in Gazipur and we will contact you first." },
  { q: "How do I book a site visit?", a: `Message us on WhatsApp at ${company.whatsapp} or call ${company.phone}, and we will arrange a time to show you the site.` },
  { q: "What sizes are the flats?", a: "Flat sizes depend on the project, and each project page lists them. Contact us for the exact size and layout of any flat." },
  { q: "Do you help with documents and registration?", a: "Yes. We guide buyers through booking and the documents involved, and explain each step up to registration so you know what to prepare." },
  { q: "How can I contact Natec?", a: `Visit our office at ${company.address}, call ${company.phone}, WhatsApp ${company.whatsapp} or email ${company.email}.` },
];

export function Faq() {
  return (
    <section className="section-pad bg-white">
      <div className="container-x grid gap-10 md:grid-cols-[1fr_1.6fr]">
        <Reveal>
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-3 text-navy">Frequently asked <em className="accent-light">questions.</em></h2>
          <p lang="bn" className="mt-4 font-display text-lg text-navy">রাজেন্দ্রপুর, শ্রীপুর, গাজীপুরে ফ্ল্যাট ও অ্যাপার্টমেন্ট</p>
        </Reveal>
        <Reveal>
          <Accordion type="single" collapsible className="border-t border-border">
            {FAQS.map((f, i) => (
              <AccordionItem key={f.q} value={`f${i}`}>
                <AccordionTrigger className="min-h-[44px] py-5 text-left font-display text-lg text-navy hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="text-[16px] leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
