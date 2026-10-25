/** Pure helpers for creating client portal logins (usernames, temp passwords, share text). */
import { USERNAME_RE } from "@/lib/login-id";

import { SITE_URL } from "./site";

export const PORTAL_LOGIN_URL = `${SITE_URL}/login`;
export const INTERNAL_EMAIL_DOMAIN = "clients.natecdev.com";
export const internalEmail = (username: string) => `${username}@${INTERNAL_EMAIL_DOMAIN}`;

const TITLES = new Set(["md", "mst", "mrs", "mr"]);

/** "MD. SHAH ALAM (UNCLE)" → "shahalamuncle" */
export function usernameFromName(name: string): string {
  const words = name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const kept = words.filter((w) => !TITLES.has(w));
  return kept.join("").slice(0, 30);
}

export function normPhone(raw: string): string | null {
  const m = (raw ?? "").replace(/[\s-]/g, "").match(/^(?:\+?880|0)?(1[3-9]\d{8})$/);
  return m ? `0${m[1]}` : null;
}

export type LoginCandidate = { id: string; full_name: string; phone: string; flat_no: string };

/**
 * Proposes one username per client: the phone when valid and unique (not used by an
 * account, not shared in the list); otherwise from the name, adding the flat number
 * (then a counter) when taken.
 */
export function proposeUsernames(clients: LoginCandidate[], takenUsernames: Set<string>, takenPhones: Set<string>): Record<string, string> {
  const count = new Map<string, number>();
  for (const c of clients) { const p = normPhone(c.phone); if (p) count.set(p, (count.get(p) ?? 0) + 1); }
  const used = new Set(takenUsernames);
  const out: Record<string, string> = {};
  for (const c of clients) {
    const p = normPhone(c.phone);
    let u = "";
    if (p && count.get(p) === 1 && !takenPhones.has(p) && !used.has(p)) u = p;
    else {
      let base = usernameFromName(c.full_name);
      if (base.length < 3) base = (base + "client").slice(0, 30);
      const flat = c.flat_no.toLowerCase().replace(/[^a-z0-9]/g, "");
      u = base;
      if (used.has(u) && flat) u = `${base}${flat}`.slice(0, 30);
      let n = 2;
      while (used.has(u)) u = `${base}${flat}${n++}`.slice(0, 30);
    }
    used.add(u);
    out[c.id] = u;
  }
  return out;
}

/** "Natec-" + 4 random digits. */
export function tempPassword(rand: (a: Uint32Array<ArrayBuffer>) => Uint32Array = (a) => crypto.getRandomValues(a)): string {
  const n = rand(new Uint32Array(1))[0]! % 10000;
  return `Natec-${String(n).padStart(4, "0")}`;
}

export const validUsername = (u: string) => USERNAME_RE.test(u);

export function shareMessage(o: { name: string; username: string; password: string; flat: string }): string {
  return `আসসালামু আলাইকুম ${o.name},
Natec Development-এর ক্লায়েন্ট পোর্টালে আপনার অ্যাকাউন্ট তৈরি হয়েছে।
ওয়েবসাইট: ${PORTAL_LOGIN_URL}
ইউজার আইডি: ${o.username}
পাসওয়ার্ড: ${o.password}
এই ইউজার আইডি ও পাসওয়ার্ড দিয়ে সরাসরি লগইন করুন। এখানে আপনার ফ্ল্যাট ${o.flat || "—"}, কিস্তির তালিকা ও পেমেন্টের হিসাব দেখতে পাবেন। চাইলে লগইনের পর নিজের পাসওয়ার্ড বদলে নিতে পারবেন।

Assalamu Alaikum ${o.name},
Your Natec Development client portal account is ready.
Website: ${PORTAL_LOGIN_URL}
User ID: ${o.username}
Password: ${o.password}
Log in with this user ID and password to see your flat ${o.flat || "—"}, instalment schedule and payments. You can change the password after logging in if you like.
— Natec Development Ltd.`;
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export function loginsCsv(rows: { flat: string; name: string; phone: string; username: string; password: string }[]): string {
  const head = ["Flat", "Name", "Phone", "Username", "Temporary password", "Login URL"];
  return [head, ...rows.map((r) => [r.flat, r.name, r.phone, r.username, r.password, PORTAL_LOGIN_URL])].map((l) => l.map(csvCell).join(",")).join("\n");
}

export const waLink = (phone: string, text: string) => {
  const p = normPhone(phone);
  return p ? `https://wa.me/88${p}?text=${encodeURIComponent(text)}` : null;
};
