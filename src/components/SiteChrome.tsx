import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { initials, useSession } from "@/lib/account";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Menu, X, Phone, Mail, MapPin, ChevronRight, LayoutDashboard, LogIn, LogOut } from "lucide-react";
import { company } from "@/lib/site";

export const logo = { url: "/brand/natec-logo.png" };
// Original brand colours on a transparent background (no white box).
const fullLogoUrl = "/brand/natec-logo-transparent.png";
const markUrl = "/brand/natec-mark.png";

const nav = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/projects", label: "Projects" },
  { to: "/construction-status", label: "Construction Status" },
  { to: "/floor-plan", label: "Floor Plan" },
  { to: "/location", label: "Location" },
  { to: "/contact", label: "Contact" },
] as const;

/** One row of the mobile menu: clean 16px sans text, chevron on the right. */
const mobileItem =
  "relative flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left font-sans text-[16px] font-medium text-navy transition-colors hover:bg-ivory hover:text-brand-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40";

export function WhatsAppIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43a9.43 9.43 0 0 1 9.43 9.44c0 5.2-4.23 9.43-9.44 9.43m8.03-17.46A11.3 11.3 0 0 0 12.05.72C5.79.72.7 5.8.7 12.07c0 2 .52 3.95 1.52 5.67L.6 23.6l6-1.57a11.3 11.3 0 0 0 5.43 1.38h.01c6.26 0 11.35-5.09 11.35-11.35 0-3.03-1.18-5.88-3.32-8.02" />
    </svg>
  );
}

export function FacebookIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.87.25-1.46 1.5-1.46h1.5V4.46A20 20 0 0 0 14.3 4.3c-2.2 0-3.7 1.34-3.7 3.8v2.4H8.1v3h2.5V21z" />
    </svg>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  const home = useLocation({ select: (l) => l.pathname === "/" });

  useEffect(() => {
    if (!home) return setSolid(true);
    const hero = document.getElementById("hero");
    const on = () => setSolid(window.scrollY > (hero ? hero.offsetHeight - window.innerHeight : 80));
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [home]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* Over the hero: a floating white bar. After it: a full-width white bar. White keeps the logo in its real colours. */}
      <div
        className={`transition-all duration-300 ${
          solid
            ? "bg-white shadow-[0_1px_0_rgba(7,47,99,0.08),0_8px_24px_-12px_rgba(7,47,99,0.25)]"
            : "mx-3 mt-2 rounded-2xl bg-white/95 shadow-[0_10px_30px_-12px_rgba(4,26,56,0.45)] md:mx-6 md:mt-3"
        }`}
      >
        <div className={`container-x flex items-center justify-between transition-all duration-300 ${solid ? "h-16 md:h-[72px]" : "h-14 md:h-16"}`}>
          <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <img src={markUrl} alt="" aria-hidden width={44} height={44} className="h-9 w-auto md:h-10" />
            <span className="font-label text-[12px] leading-tight tracking-[0.24em] text-navy">
              NATEC<span className="block text-[9px] tracking-[0.2em] text-navy/75">DEVELOPMENT LTD.</span>
            </span>
            <span className="sr-only">Natec Development Ltd. — home</span>
          </Link>
          <nav className="hidden items-center gap-6 xl:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="relative whitespace-nowrap rounded-sm py-2 font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-navy transition-colors hover:text-brand-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40"
                activeProps={{ className: "!text-brand-red after:absolute after:inset-x-0 after:-bottom-0.5 after:h-[2px] after:rounded-full after:bg-brand-red" }}
                activeOptions={{ exact: true }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <AccountLink />
            <a href={company.whatsappLink} target="_blank" rel="noreferrer" className="btn btn-primary hidden !px-5 !py-3 sm:inline-flex">
              <WhatsAppIcon /> WhatsApp
            </a>
            <a href={company.whatsappLink} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-red text-white sm:hidden">
              <WhatsAppIcon />
            </a>
            <button className="rounded-full p-2 text-navy hover:bg-navy/5 xl:hidden" onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"}>
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>
      {open && (
        <nav data-lenis-prevent aria-label="Main menu" className="mobile-menu fixed inset-0 -z-10 flex flex-col overflow-y-auto bg-white px-5 pb-8 pt-[88px] text-navy sm:px-8 md:pt-24 xl:hidden">
          <p className="px-3 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-navy/50">Menu</p>
          <ul className="mt-2">
            {nav.map((n) => (
              <li key={n.to}>
                <Link
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={mobileItem}
                  activeProps={{ className: "bg-ivory !text-brand-red before:absolute before:inset-y-2.5 before:left-0 before:w-[3px] before:rounded-full before:bg-brand-red" }}
                  activeOptions={{ exact: true }}
                >
                  {n.label}
                  <ChevronRight className="h-4 w-4 text-navy/30" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 border-t border-navy/10 px-3 pt-5 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-navy/50">Account</p>
          <div className="mt-2 flex flex-col">
            <AccountLink mobile onNavigate={() => setOpen(false)} />
          </div>
          <div className="mt-auto grid grid-cols-2 gap-3 pt-8">
            <a href={company.phoneLink} className="btn border border-navy/20 !px-4 text-navy hover:border-navy">
              <Phone className="h-4 w-4" /> Call
            </a>
            <a href={company.whatsappLink} target="_blank" rel="noreferrer" className="btn btn-primary !px-4">
              <WhatsAppIcon /> WhatsApp
            </a>
          </div>
          <p className="mt-4 flex gap-2 px-1 text-[13px] leading-snug text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-red" aria-hidden />
            {company.locationShort}
          </p>
        </nav>
      )}
    </header>
  );
}

/** Floating contact buttons: WhatsApp bottom-right, call bottom-left (fixed on every public page). */
export function FloatingContacts() {
  // Same look as muktadi.com: solid circle, soft colour ring + shadow, and a "ping" ripple that
  // grows to 2× and fades every second. Hover shows a label and scales the button up.
  const btn = "group fixed bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg ring-4 transition hover:scale-110 focus-visible:outline-none focus-visible:ring-offset-2";
  const tip = "pointer-events-none absolute whitespace-nowrap rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100";
  const ping = "pointer-events-none absolute inset-0 rounded-full animate-ping motion-reduce:hidden";
  return (
    <>
      {/* Call — left */}
      <a href={company.phoneLink} aria-label={`Call ${company.phone}`} className={`${btn} left-6 bg-navy shadow-navy/30 ring-navy/10`}>
        <Phone className="h-6 w-6" />
        <span className={`${tip} left-16`}>Call now</span>
        <span className={`${ping} bg-navy/40`} aria-hidden />
      </a>
      {/* WhatsApp — right */}
      <a href={company.whatsappLink} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp" className={`${btn} right-6 bg-whatsapp shadow-whatsapp/30 ring-whatsapp/15`}>
        <WhatsAppIcon className="h-7 w-7" />
        <span className={`${tip} right-16`}>Chat on WhatsApp</span>
        <span className={`${ping} bg-whatsapp/40`} aria-hidden />
      </a>
    </>
  );
}

export function Footer() {
  const social = "flex h-10 w-10 items-center justify-center rounded-full border border-navy/15 text-navy transition hover:border-brand-red hover:bg-brand-red hover:text-white";
  return (
    <footer className="border-t-4 border-brand-red bg-ivory text-ink">
      <div className="container-x grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1.4fr] md:py-20">
        <div>
          <img src={fullLogoUrl} alt="Natec Development Ltd. logo" width={120} height={144} loading="lazy" className="h-28 w-auto md:h-32" />
          <p className="mt-5 max-w-xs text-sm text-muted-foreground">Well-planned homes in {company.locationShort} — built floor by floor since 2023.</p>
          <div className="mt-6 flex gap-3">
            <a href={company.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className={social}><FacebookIcon /></a>
            <a href={company.whatsappLink} target="_blank" rel="noreferrer" aria-label="WhatsApp" className={social}><WhatsAppIcon /></a>
          </div>
        </div>
        <div>
          <h4 className="eyebrow mb-5 !text-brand-red">Quick links</h4>
          <ul className="space-y-2 text-sm">
            {nav.map((n) => <li key={n.to}><Link to={n.to} className="text-navy/80 transition hover:text-brand-red">{n.label}</Link></li>)}
          </ul>
        </div>
        <div className="space-y-3 text-sm">
          <h4 className="eyebrow mb-5 !text-brand-red">Contact</h4>
          <a className="flex items-center gap-3 text-navy/80 transition hover:text-brand-red" href={company.whatsappLink}><WhatsAppIcon /> {company.whatsapp}</a>
          <a className="flex items-center gap-3 text-navy/80 transition hover:text-brand-red" href={company.phoneLink}><Phone className="h-4 w-4" /> {company.phone}</a>
          <a className="flex items-center gap-3 text-navy/80 transition hover:text-brand-red" href={`mailto:${company.email}`}><Mail className="h-4 w-4" /> {company.email}</a>
          <p className="flex gap-3 text-muted-foreground"><MapPin className="h-4 w-4 shrink-0 text-navy" /> {company.address}</p>
        </div>
      </div>
      <div className="bg-navy py-5 text-center text-xs tracking-wide text-white/80">© {new Date().getFullYear()} Natec Development Ltd. · All rights reserved.</div>
    </footer>
  );
}

export type Crumb = { label: string; to?: "/" | "/projects" | "/about" | "/construction-status" };

/** Shared page hero. With `image` it renders full-bleed (photo + navy veil, copy bottom-left, scroll parallax). */
export function PageHero({ eyebrow, title, intro, image, imageAlt = "", imagePosition = "center", crumbs, children, top, heightClass = "min-h-[78svh] md:min-h-[76svh]" }: {
  eyebrow: string; title: React.ReactNode; intro?: React.ReactNode; image?: string | null; imageAlt?: string; imagePosition?: string; crumbs?: Crumb[]; children?: React.ReactNode; top?: React.ReactNode; heightClass?: string;
}) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!el || !image || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const write = () => { raf = 0; el.style.setProperty("--hp", Math.min(1, Math.max(0, window.scrollY / (el.offsetHeight || 1))).toFixed(3)); };
    const on = () => { if (!raf) raf = requestAnimationFrame(write); };
    write();
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); if (raf) cancelAnimationFrame(raf); };
  }, [el, image]);
  const crumbNav = crumbs && (
    <nav aria-label="Breadcrumb" className="eyebrow hero-in !text-[11px] text-white/60">
      {crumbs.map((c, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden> › </span>}
          {c.to ? <Link to={c.to} className="hover:text-white">{c.label}</Link> : <span aria-current="page" className="text-white/85">{c.label}</span>}
        </span>
      ))}
    </nav>
  );
  if (!image) {
    return (
      <section className="bg-navy text-white">
        <div className="container-x py-16 md:py-24">
          {crumbNav}
          <p className="eyebrow text-muted-dark">{eyebrow}</p>
          <h1 className="mt-4 max-w-3xl">{title}</h1>
          {intro && <p className="mt-5 max-w-[62ch] text-lg text-muted-dark">{intro}</p>}
          {children}
        </div>
      </section>
    );
  }
  return (
    <section ref={setEl} className={`relative isolate flex ${heightClass} items-end overflow-hidden bg-navy text-white`}>
      <img src={image} alt={imageAlt} width={1600} height={1000} fetchPriority="high" className="about-hero-img absolute inset-0 h-full w-full object-cover" style={{ objectPosition: imagePosition }} />
      <div className="about-hero-veil absolute inset-0" aria-hidden />
      <div className="about-hero-copy container-x relative z-10 pb-14 pt-28 md:pb-20">
        {top && <div className="hero-in mb-4">{top}</div>}
        {crumbNav}
        <p className="eyebrow hero-in mt-8 text-white/70" style={{ animationDelay: "120ms" }}>{eyebrow}</p>
        <h1 className="hero-in mt-4 max-w-[22ch]" style={{ animationDelay: "220ms" }}>{title}</h1>
        {intro && <p className="hero-in mt-6 max-w-[56ch] text-lg text-white/85" style={{ animationDelay: "340ms" }}>{intro}</p>}
        {children && <div className="hero-in mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: "460ms" }}>{children}</div>}
      </div>
    </section>
  );
}

export function Reveal({ children, className = "", delay = 0, as: Tag = "div" }: { children: React.ReactNode; className?: string; delay?: number; as?: "div" | "section" }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) { el.setAttribute("data-in", ""); io.disconnect(); }
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  return <Tag ref={setEl as never} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>{children}</Tag>;
}

function AccountLink({ mobile, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const session = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  useEffect(() => {
    // "Remember me" off: end the session when the browser was closed.
    if (session && localStorage.getItem("natec-temp-session") && !sessionStorage.getItem("natec-alive")) {
      localStorage.removeItem("natec-temp-session");
      supabase.auth.signOut();
    }
  }, [session]);
  const user = session?.user;
  async function logout() {
    await qc.cancelQueries();
    qc.removeQueries({ queryKey: ["me"] });
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }
  if (!user) {
    if (mobile) {
      return (
        <Link to="/login" onClick={onNavigate} className={mobileItem}>
          <span className="flex items-center gap-3"><LogIn className="h-4 w-4 text-navy/50" aria-hidden />Login</span>
          <ChevronRight className="h-4 w-4 text-navy/30" aria-hidden />
        </Link>
      );
    }
    return (
      <Link to="/login" onClick={onNavigate} className="inline-flex min-h-[44px] items-center whitespace-nowrap px-2 font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-navy transition-colors hover:text-brand-red">
        Login
      </Link>
    );
  }
  const name = String(user.user_metadata?.["full_name"] ?? "");
  if (mobile) {
    return (
      <>
        <Link to="/account" onClick={onNavigate} className={mobileItem}>
          <span className="flex min-w-0 items-center gap-3">
            <LayoutDashboard className="h-4 w-4 shrink-0 text-navy/50" aria-hidden />
            <span className="truncate">Dashboard{name ? <span className="font-normal text-muted-foreground"> · {name}</span> : null}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-navy/30" aria-hidden />
        </Link>
        <button onClick={() => { onNavigate?.(); logout(); }} className={`${mobileItem} !text-brand-red`}>
          <span className="flex items-center gap-3"><LogOut className="h-4 w-4" aria-hidden />Logout</span>
        </button>
      </>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Account menu" className="flex h-10 w-10 items-center justify-center rounded-full bg-navy font-label text-[13px] text-white ring-offset-2 hover:ring-2 hover:ring-brand-red focus-visible:ring-2 focus-visible:ring-brand-red">
        {initials(name, user.email ?? "")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-xs text-muted-foreground"><p className="truncate font-semibold text-navy">{name || "My account"}</p><p className="truncate">{user.email}</p></div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: "/account" })}>Dashboard</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: "/account", search: { tab: "saved" } })}>Saved projects</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} className="text-brand-red">Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
