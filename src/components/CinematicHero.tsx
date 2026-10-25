import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { company } from "@/lib/site";
import { WhatsAppIcon } from "@/components/SiteChrome";

/** Number of image files in /hero-natec/{d,m}/ (0001.webp … 0120.webp). */
const FRAMES = 120;
/** Chapter, brightness and cloud timings below are written on a 1–200 "story" scale, independent of FRAMES. */
const STORY = 200;
export const frameSrc = (dir: "d" | "m", i: number) => `/hero-natec/${dir}/${String(i).padStart(4, "0")}.webp`;
/** File number for a frame given on the 1–200 story scale. */
const storyToFile = (n: number) => Math.round(((n - 1) * (FRAMES - 1)) / (STORY - 1)) + 1;

type Chapter = { range: [number, number]; eyebrow?: string; title: React.ReactNode; body?: string; cta?: "intro" | "end"; still?: number };
const CHAPTERS: Chapter[] = [
  { range: [1, 24], eyebrow: "Natec Development Ltd. · Est. 2023", title: <>From bare land <em className="accent-dark block">to lasting homes.</em></>, body: `Homes in ${company.locationShort} — built floor by floor.`, cta: "intro" },
  { range: [25, 59], title: "Rise above the noise.", body: "Green surroundings, open rooftops, fresh morning air." },
  { range: [60, 82], eyebrow: "Project 03", title: "Meet Shobuj Digonto.", body: "Pepsi Gate, Rajendrapur Bazar, Sreepur, Gazipur · B+G+6 · 26 flats", still: 70 },
  { range: [83, 118], eyebrow: "Step inside", title: "Bright, airy living.", body: "Tiled floors, false ceilings and cross-ventilation in every home.", still: 100 },
  { range: [119, 141], title: "Made for family meals.", body: "An open dining area with a fitted kitchen.", still: 130 },
  { range: [142, 165], title: "Rest easy.", body: "Quiet bedrooms with built-in wardrobes and big windows.", still: 153 },
  { range: [166, 182], title: "Your own green view.", body: "Every home has a private balcony." },
  { range: [183, 200], title: "Your home in Rajendrapur starts here.", cta: "end", still: 197 },
];
const BRIGHT: [number, number][] = [[21, 29], [40, 47], [48, 66], [174, 187]];
const inRange = (f: number, [a, b]: [number, number]) => f >= a && f <= b;

const headShadow: React.CSSProperties = { textShadow: "0 2px 18px rgba(0,0,0,0.45)" };
const bodyShadow: React.CSSProperties = { textShadow: "0 1px 12px rgba(0,0,0,0.45)", color: "#E8ECF3" };
const SCRIM = "radial-gradient(ellipse at 20% 85%, rgba(4,26,56,0.62) 0%, rgba(4,26,56,0.35) 35%, transparent 65%)";
const M_BOTTOM = "linear-gradient(to top, rgba(4,26,56,0.88) 0%, rgba(4,26,56,0.55) 45%, transparent 100%)";

function Buttons({ kind }: { kind: "intro" | "end" }) {
  const wa = (
    <a href={company.whatsappLink} target="_blank" rel="noreferrer" className="btn btn-primary h-12 flex-1 !px-3 desk:h-auto desk:flex-none desk:!px-[26px]">
      <WhatsAppIcon /> Book a site visit
    </a>
  );
  const proj = <Link to="/projects" className="btn btn-ghost-dark h-12 flex-1 !px-3 desk:h-auto desk:flex-none desk:!px-[26px]">View projects</Link>;
  return <div className="mt-5 flex gap-3 desk:mt-7">{kind === "intro" ? <>{proj}{wa}</> : <>{wa}{proj}</>}</div>;
}

function ChapterBody({ c, first }: { c: Chapter; first?: boolean }) {
  // Only the first chapter is a heading (the page's single H1); the others are styled text.
  const H = first ? "h1" : "p";
  return (
    <>
      {c.eyebrow && <p className="eyebrow !text-[11px] text-white/85 desk:!text-[13px]" style={bodyShadow}>{c.eyebrow}</p>}
      <H className="mt-3 font-display font-medium leading-[1.05] tracking-[-0.015em] !text-[clamp(2rem,9vw,2.6rem)] text-white desk:!text-[clamp(2.6rem,6vw,5.2rem)]" style={headShadow}>{c.title}</H>
      {c.body && <p className="mt-3 max-w-[62ch] text-[15px] font-medium desk:mt-4 desk:text-[17px]" style={bodyShadow}>{c.body}</p>}
      {c.cta && <Buttons kind={c.cta} />}
    </>
  );
}

export function CinematicHero() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return reduced ? <StaticHero /> : <FlyHero />;
}

/** Background film (looped, muted): VP9 WebM first (smaller), H.264 MP4 for Safari. The chapter text follows its playback position. */
export const HERO_VIDEO = {
  d: { webm: "/hero-natec/video/natec-hero-1080p.webm", mp4: "/hero-natec/video/natec-hero-1080p.mp4", poster: "/hero-natec/video/poster-d.webp" },
  m: { webm: "/hero-natec/video/natec-hero-mobile.webm", mp4: "/hero-natec/video/natec-hero-mobile.mp4", poster: "/hero-natec/video/poster-m.webp" },
} as const;
const CLOUD_FADE_FRAMES = 14; // drifting clouds fade out over the first story frames of each loop

function FlyHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const brightRef = useRef<HTMLDivElement>(null);
  const cloudsRef = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState(0);
  const [dir, setDir] = useState<"d" | "m" | null>(null);

  // Pick the portrait (phone) or landscape film after mount, so the server render is the same for everyone.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px) and (orientation: portrait)");
    const pick = () => setDir(mq.matches ? "m" : "d");
    pick();
    mq.addEventListener("change", pick);
    return () => mq.removeEventListener("change", pick);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !dir) return;
    let raf = 0, lastChapter = -1, lastBright = false, lastCloud = -1;
    const tick = () => {
      const dur = v.duration || 0;
      const pos = dur ? Math.min(1, v.currentTime / dur) : 0;
      const story = Math.round(pos * (STORY - 1)) + 1;
      const ch = Math.max(0, CHAPTERS.findIndex((c) => inRange(story, c.range)));
      if (ch !== lastChapter) { lastChapter = ch; setChapter(ch); }
      const bright = BRIGHT.some((r) => inRange(story, r));
      if (bright !== lastBright) { lastBright = bright; if (brightRef.current) brightRef.current.style.opacity = bright ? "0.2" : "0"; }
      const cloud = Math.round(Math.max(0, 1 - (story - 1) / CLOUD_FADE_FRAMES) * 100) / 100;
      if (cloud !== lastCloud && cloudsRef.current) { lastCloud = cloud; cloudsRef.current.style.opacity = String(cloud); cloudsRef.current.style.visibility = cloud > 0 ? "visible" : "hidden"; }
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${pos})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Pause while the hero is off screen (saves battery); resume when it comes back.
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.05 });
    io.observe(v);
    v.play().catch(() => {});
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [dir]);

  const media = HERO_VIDEO[dir ?? "d"];
  return (
    <section id="hero" className="relative h-[100svh] min-h-[560px] overflow-hidden bg-navy-deep text-white">
      {dir && (
        <video
          key={dir}
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          poster={media.poster}
          autoPlay muted loop playsInline preload="auto"
          disablePictureInPicture
          aria-hidden
        >
          <source src={media.webm} type='video/webm; codecs="vp9"' />
          <source src={media.mp4} type="video/mp4" />
        </video>
      )}
      {!dir && <img src={HERO_VIDEO.d.poster} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />}

      {/* Drifting clouds over the opening seconds (fade out as the film starts) */}
      <div ref={cloudsRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="cloud-layer cloud-far" style={{ backgroundImage: "url(/hero-natec/clouds-far.webp)" }} />
        <div className="cloud-layer cloud-near" style={{ backgroundImage: "url(/hero-natec/clouds-near.webp)" }} />
      </div>

      {/* Mobile gradients */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[120px] md:hidden" style={{ background: "linear-gradient(to bottom, rgba(4,26,56,0.45), transparent)" }} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] md:hidden" style={{ background: M_BOTTOM }} />
      {/* Desktop scrims */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block" style={{ background: SCRIM }} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[30%] md:block" style={{ background: "linear-gradient(to bottom, transparent, rgba(4,26,56,0.45))" }} />
      {/* Extra scrim on bright moments (+20%) */}
      <div ref={brightRef} aria-hidden className="pointer-events-none absolute inset-0 transition-opacity duration-700" style={{ background: "rgba(4,26,56,1)", opacity: 0 }} />

      {/* Film progress */}
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        <div ref={progressRef} className="absolute inset-0 origin-left bg-brand-red" style={{ transform: "scaleX(0)" }} />
      </div>

      {CHAPTERS.map((c, i) => (
        <div
          key={i}
          data-on={i === chapter ? "" : undefined}
          aria-hidden={i !== chapter}
          className="chapter absolute bottom-[calc(96px+env(safe-area-inset-bottom))] left-5 right-5 md:bottom-[12vh] md:left-[6vw] md:right-auto md:max-w-[620px]"
        >
          <ChapterBody c={c} first={i === 0} />
        </div>
      ))}

      <div className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex">
        <span className="eyebrow whitespace-nowrap !text-[10px] text-white/80">Scroll to explore</span>
        <span className="block h-10 w-px overflow-hidden bg-white/20"><span className="scroll-hint-line block h-full w-full bg-white" /></span>
      </div>
    </section>
  );
}

function StaticHero() {
  return (
    <section id="hero" className="bg-navy-deep text-white">
      <div className="relative h-[100svh]">
        <picture>
          <source media="(max-width: 767px)" srcSet={frameSrc("m", 1)} />
          <img src={frameSrc("d", 1)} alt={`Natec Development homes in ${company.locationShort}`} width={1920} height={1080} className="absolute inset-0 h-full w-full object-cover" />
        </picture>
        <div className="absolute inset-x-0 bottom-0 h-[55%] md:hidden" style={{ background: M_BOTTOM }} />
        <div className="absolute inset-0 hidden md:block" style={{ background: SCRIM }} />
        <div className="absolute bottom-[96px] left-5 right-5 md:bottom-[12vh] md:left-[6vw] md:right-auto md:max-w-[620px]"><ChapterBody c={CHAPTERS[0]!} first /></div>
      </div>
      <div className="container-x space-y-16 py-16">
        {CHAPTERS.slice(1).map((c, i) => (
          <div key={i} className="grid items-center gap-6 md:grid-cols-2">
            {c.still && <img src={frameSrc("d", storyToFile(c.still))} alt="" loading="lazy" width={1920} height={1080} className="aspect-video w-full rounded-2xl object-cover" />}
            <div><ChapterBody c={c} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}
