import { createHash } from "node:crypto";

/** Helpers for finding a picture for an email sender. Pure and server-side. */

/** Free mailbox providers: the domain says nothing about who the sender is, so a site logo would be misleading. */
const GENERIC_PROVIDERS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "ymail.com",
  "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.com", "qq.com", "163.com", "yandex.com",
]);

const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "ac", "edu"]);

const EMAIL = /^[^@\s]{1,64}@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i;

export function isEmail(value: string): boolean {
  return value.length <= 254 && EMAIL.test(value);
}

/** "notifications@mail.stripe.com" becomes "stripe.com". Returns null if the address is not valid. */
export function rootDomain(address: string): string | null {
  const m = address.trim().toLowerCase().match(EMAIL);
  if (!m) return null;
  const parts = m[1].split(".");
  const n = parts.length;
  // Handle names like bbc.co.uk
  if (n >= 3 && parts[n - 1].length === 2 && SECOND_LEVEL.has(parts[n - 2])) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

export const isGenericProvider = (domain: string) => GENERIC_PROVIDERS.has(domain);

/** Gravatar: a personal photo, when the sender has registered one. d=404 means "tell me if there is none". */
export function gravatarUrl(email: string): string {
  const hash = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=128&d=404`;
}

/** Site logos, best source first. Both answer 404 when they have nothing for the domain. */
export function logoUrls(domain: string): string[] {
  return [
    `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(`http://${domain}`)}&size=128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ];
}

/** Candidate image URLs for a sender, in the order they should be tried. */
export function avatarCandidates(email: string): string[] {
  const out = [gravatarUrl(email)];
  const domain = rootDomain(email);
  if (domain && !isGenericProvider(domain)) out.push(...logoUrls(domain));
  return out;
}

/** Google profile pictures only ever live on these hosts. */
export function isGoogleImageHost(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname.endsWith(".googleusercontent.com") || u.hostname.endsWith(".ggpht.com"));
  } catch {
    return false;
  }
}

/** Asks Google for a 128px square version of a profile picture. */
export function sizedGoogleImage(url: string): string {
  return /=s\d+(-c)?$/.test(url) ? url.replace(/=s\d+(-c)?$/, "=s128-c") : url;
}
