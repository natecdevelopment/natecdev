import { company } from "@/lib/site";
import { SITE_URL } from "@/lib/site";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, Building2, CalendarClock, Heart, LineChart, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBdPhone } from "@/components/InquiryForm";
import { passwordScore } from "@/lib/money";
import { safeNext } from "@/lib/account";
import { signInAny } from "@/lib/login-client";
import { suggestUsername, USERNAME_RE } from "@/lib/login-id";
import { EASE, Field, SubmitButton, type SubmitState } from "./AuthFields";

type Mode = "login" | "register";
const COPY = {
  login: { h: "Welcome back to Natec", pts: [[LineChart, "Track your flat's construction"], [Wallet, "See your payment schedule"], [Heart, "Save the projects you like"]] },
  register: { h: "Create your Natec account", pts: [[Bell, "Save projects and get updates"], [CalendarClock, "Book a site visit faster"], [Building2, "Clients get a full payment and progress view"]] },
} as const;

function useDesktop() {
  const [d, setD] = useState(true);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const on = () => setD(m.matches);
    on(); m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return d;
}

export function AuthScreen({ mode, next }: { mode: Mode; next?: string | undefined }) {
  const desktop = useDesktop();
  const reduce = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const navigate = useNavigate();
  const target = safeNext(next);
  // A temporary password works as a normal login; the dashboard then suggests setting a new one.
  async function signedIn() {
    const { data } = await supabase.auth.getUser();
    return !!data.user;
  }

  useEffect(() => {
    const go = () => signedIn().then((yes) => {
      if (yes) navigate({ to: target as "/account", replace: true });
    });
    go();
    const { data: sub } = supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN") go(); });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finish() {
    const pending = sessionStorage.getItem("natec-pending-save");
    if (pending) {
      sessionStorage.removeItem("natec-pending-save");
      const { data } = await supabase.auth.getUser();
      if (data.user) await supabase.from("saved_projects").upsert({ user_id: data.user.id, project_id: pending });
    }
    setLeaving(true);
    setTimeout(() => navigate({ to: target as "/account" }), reduce ? 150 : 450);
  }

  const dur = reduce ? 0.15 : 0.7;
  const form = mode === "login" ? <LoginForm key="login" onDone={finish} next={next} /> : <RegisterForm key="register" next={next} />;

  return (
    <section className="relative bg-ivory pb-14 pt-6 lg:min-h-[calc(100svh-72px)]">
      {desktop ? (
        <div className="relative mx-auto grid w-full grid-cols-2">
          <motion.div className="relative z-10 bg-white" initial={false} animate={{ x: mode === "login" ? "0%" : "100%" }} transition={{ duration: dur, ease: EASE }}>
            <AutoHeight dur={dur}>
              <div className="flex min-h-[calc(100svh-152px)] items-center justify-center px-10 py-12">
                <div className="w-full max-w-md">
                  <AnimatePresence mode="wait" initial={false}>{form}</AnimatePresence>
                </div>
              </div>
            </AutoHeight>
          </motion.div>
          <motion.aside className="absolute inset-y-0 w-1/2 text-white [overflow:clip]" initial={false} animate={{ left: mode === "login" ? "50%" : "0%" }} transition={{ duration: dur, ease: EASE }}>
            <div className="sticky top-[96px] h-[calc(100svh-120px)] max-h-full">
              <BrandPanel mode={mode} />
            </div>
          </motion.aside>
        </div>
      ) : (
        <div className="px-4 py-8" style={{ perspective: 1200 }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={mode} className="mx-auto max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
              initial={reduce ? { opacity: 0 } : { rotateY: 90, opacity: 0.4 }} animate={reduce ? { opacity: 1 } : { rotateY: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { rotateY: -90, opacity: 0.4 }} transition={{ duration: reduce ? 0.15 : 0.3, ease: EASE }}>
              <div className="bg-navy px-6 pb-6 pt-5 text-white" style={{ background: "linear-gradient(135deg, rgba(4,26,56,0.97), rgba(7,47,99,0.9))" }}>
                <img src="/brand/natec-logo-transparent.png" alt="Natec Development Ltd." width={48} height={58} className="h-12 w-auto rounded bg-white/95 p-1" />
                <p className="mt-3 font-display text-2xl">{COPY[mode].h}</p>
              </div>
              <div className="p-6">{form}</div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
      <AnimatePresence>{leaving && <motion.div className="fixed inset-0 z-[60] bg-ivory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0.15 : 0.4 }} />}</AnimatePresence>
    </section>
  );
}

function BrandPanel({ mode }: { mode: Mode }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative h-full overflow-hidden">
      <img src="/projects/shobuj-angon/front.webp" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, rgba(4,26,56,0.92), rgba(7,47,99,0.75))" }} />
      <div className="relative box-border flex h-full min-w-0 flex-col justify-between gap-6 px-6 py-10 md:px-12">
        <img src="/brand/natec-logo-transparent.png" alt="Natec Development Ltd." width={90} height={108} className="h-24 w-auto self-start rounded-xl bg-white/95 p-2" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={mode} initial={{ opacity: 0, y: reduce ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0.15 : 0.45, ease: EASE }}>
            <h2 className="max-w-[16ch] text-white">{COPY[mode].h}</h2>
            <ul className="mt-8 space-y-4">
              {COPY[mode].pts.map(([Icon, t]) => (
                <li key={t} className="flex items-center gap-4 text-lg text-white/90"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30"><Icon className="h-5 w-5" strokeWidth={1.5} /></span>{t}</li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
        <p className="min-w-0 break-words text-sm text-white/60">Natec Development Ltd. · {company.locationShort}</p>
      </div>
    </div>
  );
}

function AutoHeight({ children, dur }: { children: React.ReactNode; dur: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | "auto">("auto");
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return <motion.div initial={false} animate={{ height: h }} transition={{ duration: dur * 0.5, ease: EASE }} className="overflow-hidden"><div ref={ref}>{children}</div></motion.div>;
}

function Stagger({ children }: { children: React.ReactNode[] }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial="hide" animate="show" exit="out" variants={{ show: { transition: { staggerChildren: reduce ? 0 : 0.04 } } }}>
      {children.filter(Boolean).map((c, i) => (
        <motion.div key={i} className="mb-4" transition={{ duration: reduce ? 0.15 : 0.4, ease: EASE }}
          variants={{ hide: { opacity: 0, x: reduce ? 0 : 40 }, show: { opacity: 1, x: 0 }, out: { opacity: 0, x: reduce ? 0 : -40, transition: { duration: reduce ? 0.15 : 0.25 } } }}>
          {c}
        </motion.div>
      ))}
    </motion.div>
  );
}

function LoginForm({ onDone, next }: { onDone: () => void; next?: string | undefined }) {
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [shake, setShake] = useState(0);
  const [state, setState] = useState<SubmitState>("idle");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const identifier = String(f.get("identifier") || "").trim(), password = String(f.get("password") || "");
    const er: Record<string, string> = {};
    if (!identifier) er["identifier"] = "Enter your email, phone or username.";
    if (!password) er["password"] = "Enter your password.";
    setErrs(er); setShake((s) => s + 1);
    if (Object.keys(er).length) return;
    setState("loading");
    const error = await signInAny(identifier, password);
    if (error) { setState("idle"); setErrs({ password: error }); return; }
    if (f.get("remember")) localStorage.removeItem("natec-temp-session");
    else { localStorage.setItem("natec-temp-session", "1"); sessionStorage.setItem("natec-alive", "1"); }
    setState("success");
    setTimeout(onDone, 650);
  }
  return (
    <motion.form onSubmit={submit} noValidate>
      <Stagger>
        {[
          <div key="h"><p className="eyebrow text-brand-red">Login</p><h1 className="mt-2 !text-4xl text-navy">Sign in to your account</h1></div>,
          <Field key="e" label="Email, phone or username" name="identifier" placeholder="e.g. 01712345678 or yourname" autoComplete="username" error={errs["identifier"]} shakeKey={shake} />,
          <Field key="p" label="Password" name="password" password autoComplete="current-password" error={errs["password"]} shakeKey={shake} />,
          <div key="r" className="flex items-center justify-between text-sm">
            <label className="flex min-h-[44px] items-center gap-2 text-navy"><input type="checkbox" name="remember" defaultChecked className="h-4 w-4 accent-[var(--navy)]" /> Remember me</label>
            <Link to="/forgot-password" className="text-navy underline-offset-4 hover:text-brand-red hover:underline">Forgot password?</Link>
          </div>,
          <SubmitButton key="s" state={state}>Login →</SubmitButton>,
          <p key="l" className="text-center text-sm text-muted-foreground">Don't have an account? <Link to="/register" search={next ? { redirect: next } : {}} className="font-semibold text-brand-red hover:underline">Register</Link></p>,
        ]}
      </Stagger>
    </motion.form>
  );
}

function RegisterForm({ next }: { next?: string | undefined }) {
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [shake, setShake] = useState(0);
  const [state, setState] = useState<SubmitState>("idle");
  const [pw, setPw] = useState("");
  const [sent, setSent] = useState("");
  const [uname, setUname] = useState(""); const [touched, setTouched] = useState(false);
  const [avail, setAvail] = useState<null | boolean>(null);
  const score = passwordScore(pw);
  useEffect(() => {
    setAvail(null);
    if (!USERNAME_RE.test(uname)) return;
    const t = setTimeout(() => supabase.rpc("username_available", { _u: uname }).then(({ data }) => setAvail(!!data)), 350);
    return () => clearTimeout(t);
  }, [uname]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("full_name") || "").trim(), phoneRaw = String(f.get("phone") || ""), email = String(f.get("email") || "").trim();
    const password = String(f.get("password") || ""), confirm = String(f.get("confirm") || "");
    const phone = normalizeBdPhone(phoneRaw);
    const er: Record<string, string> = {};
    if (!name) er["full_name"] = "Enter your full name.";
    if (!USERNAME_RE.test(uname)) er["username"] = "3–30 characters: lowercase letters, numbers, dot or underscore.";
    else if (avail === false) er["username"] = "This username is taken.";
    if (!phone) er["phone"] = "Enter a Bangladesh mobile number, e.g. 01712-345678 or +880 1712-345678.";
    if (!/^\S+@\S+\.\S+$/.test(email)) er["email"] = "Enter a valid email address.";
    if (password.length < 8) er["password"] = "Use at least 8 characters.";
    if (confirm !== password) er["confirm"] = "Passwords don't match.";
    if (!f.get("terms")) er["terms"] = "Please agree to the Terms and Privacy Policy.";
    setErrs(er); setShake((s) => s + 1);
    if (Object.keys(er).length) return;
    setState("loading");
    const [{ data: uOk }, { data: pOk }] = await Promise.all([supabase.rpc("username_available", { _u: uname }), supabase.rpc("phone_available", { _p: phone! })]);
    if (!uOk || !pOk) {
      setState("idle"); setShake((s) => s + 1);
      setErrs({ ...(!uOk ? { username: "This username is taken." } : {}), ...(!pOk ? { phone: "An account with this phone number already exists. Try logging in." } : {}) });
      return;
    }
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${SITE_URL}/login`, data: { full_name: name.slice(0, 120), phone, username: uname } } });
    if (error) { setState("idle"); setErrs({ email: /registered|exists/i.test(error.message) ? "An account with this email already exists. Try logging in." : error.message }); return; }
    setState("success");
    setTimeout(() => setSent(email), 700);
  }
  if (sent) {
    return (
      <motion.div key="sent" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center" role="status">
        <p className="eyebrow text-brand-red">Almost there</p>
        <h1 className="mt-2 !text-3xl text-navy">Check your email to confirm your account</h1>
        <p className="mt-3 text-muted-foreground">We sent a confirmation link to <strong className="text-navy">{sent}</strong>. Open it, then log in.</p>
        <Link to="/login" search={next ? { redirect: next } : {}} className="btn btn-primary mt-6">Go to login</Link>
      </motion.div>
    );
  }
  const meter = ["Too short", "Weak", "Fair", "Good", "Strong"][score];
  return (
    <motion.form onSubmit={submit} noValidate>
      <Stagger>
        {[
          <div key="h"><p className="eyebrow text-brand-red">Register</p><h1 className="mt-2 !text-4xl text-navy">Create your account</h1></div>,
          <Field key="n" label="Full name" name="full_name" autoComplete="name" error={errs["full_name"]} shakeKey={shake} onChange={(v) => { if (!touched) setUname(suggestUsername(v)); }} />,
          <Field key="u" label="Username" name="username" autoComplete="username" value={uname} error={errs["username"]} shakeKey={shake}
            onChange={(v) => { setTouched(true); setUname(v.toLowerCase().replace(/\s/g, "")); }}>
            {uname && !errs["username"] && (
              <p className={`mt-1.5 text-sm ${avail === false || !USERNAME_RE.test(uname) ? "text-brand-red" : "text-navy/70"}`} aria-live="polite">
                {!USERNAME_RE.test(uname) ? "3–30 characters: lowercase letters, numbers, dot or underscore." : avail === null ? "Checking…" : avail ? "✓ Available" : "Taken — try another"}
              </p>
            )}
          </Field>,
          <Field key="ph" label="Phone (01XXXXXXXXX)" name="phone" type="tel" inputMode="tel" autoComplete="tel" error={errs["phone"]} shakeKey={shake} />,
          <Field key="e" label="Email" name="email" type="email" inputMode="email" autoComplete="email" error={errs["email"]} shakeKey={shake} />,
          <Field key="p" label="Password" name="password" password autoComplete="new-password" error={errs["password"]} shakeKey={shake} onChange={setPw}>
            {pw && (
              <div className="mt-2 flex items-center gap-3" aria-live="polite">
                <div className="flex flex-1 gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? (score >= 3 ? "bg-navy" : "bg-brand-red") : "bg-navy/10"}`} />)}</div>
                <span className="text-xs text-muted-foreground">{meter}</span>
              </div>
            )}
          </Field>,
          <Field key="c" label="Confirm password" name="confirm" password autoComplete="new-password" error={errs["confirm"]} shakeKey={shake} />,
          <div key="t">
            <label className="flex min-h-[44px] items-start gap-3 text-sm text-navy">
              <input type="checkbox" name="terms" className="mt-1 h-4 w-4 accent-[var(--navy)]" />
              <span>I agree to the <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link></span>
            </label>
            {errs["terms"] && <p role="alert" className="text-sm text-brand-red">{errs["terms"]}</p>}
          </div>,
          <SubmitButton key="s" state={state}>Create account →</SubmitButton>,
          <p key="l" className="text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" search={next ? { redirect: next } : {}} className="font-semibold text-brand-red hover:underline">Login</Link></p>,
        ]}
      </Stagger>
    </motion.form>
  );
}

