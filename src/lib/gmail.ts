import { headers } from "next/headers";
import sanitizeHtml from "sanitize-html";
import { getToken } from "next-auth/jwt";
import { refreshAccessToken } from "@/auth";
import type { ApiError, ApiMail, MailAction } from "./mail-types";
import { isSecureRequest } from "./cookies";
import { Semaphore, TtlCache, isRateLimit, retryDelayMs } from "./gmail-throttle";
import { classify, extractFacts, summarize } from "./summarize";

/** Server-side Gmail helpers. Never import this from a client component: it handles the user's access token. */

export class GmailError extends Error {
  constructor(
    public status: number,
    public code: ApiError["code"],
    message: string,
  ) {
    super(message);
  }
}

const REAUTH = () => new GmailError(401, "reauth", "Your Google session expired. Please sign in again.");

/** Reads the access token from the encrypted session cookie, refreshing it if it has expired. */
export async function getAccessToken(): Promise<string> {
  const requestHeaders = await headers();
  // On https the login cookie has a different name ("__Secure-..."), so say which one to look for.
  const secureCookie = isSecureRequest(requestHeaders, process.env.AUTH_URL);
  const token = await getToken({ req: { headers: requestHeaders }, secret: process.env.AUTH_SECRET, secureCookie });
  if (!token) throw new GmailError(401, "unauthenticated", "You are not signed in.");
  if (token.error) throw REAUTH();

  const expired = !token.accessToken || (token.expiresAt !== undefined && Date.now() / 1000 >= token.expiresAt - 30);
  if (!expired) return token.accessToken!;

  if (!token.refreshToken) throw REAUTH();
  const fresh = await refreshAccessToken(token);
  if (fresh.error || !fresh.accessToken) throw REAUTH();
  return fresh.accessToken;
}

/**
 * Gmail allows about 250 quota units per second per user, and downloading one email costs 5.
 * Downloads therefore go through a small queue (3 at a time), and a "slow down" answer is retried with a short wait
 * instead of being shown to the user. Swipes (label changes) skip the queue so they never wait behind a big download.
 */
const downloads = new Semaphore(3);
const MAX_RETRIES = 4;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function gmail<T>(accessToken: string, path: string, init?: RequestInit, opts: { urgent?: boolean } = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const send = () =>
      fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        cache: "no-store",
      });
    const res = await (opts.urgent ? send() : downloads.run(send));
    if (res.ok) return (await res.json()) as T;

    const body = await res.json().catch(() => ({}));
    const reason: string = body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? "";
    const message: string = body?.error?.message ?? res.statusText;
    const text = `${reason} ${message}`;

    if ((isRateLimit(res.status, text) || res.status === 503) && attempt < MAX_RETRIES) {
      await sleep(retryDelayMs(attempt, res.headers.get("retry-after")));
      continue;
    }
    if (res.status === 401) throw REAUTH();
    if (res.status === 403 && /accessNotConfigured|SERVICE_DISABLED/i.test(text)) {
      throw new GmailError(503, "api_disabled", "The Gmail API is not enabled for this Google Cloud project. Enable it, then try again.");
    }
    if (res.status === 403 && /insufficient|PERMISSION_DENIED/i.test(text)) {
      throw new GmailError(403, "scope", "SwipeMail does not have permission to change your mail. Sign out and sign in again, and approve the Gmail permission.");
    }
    if (isRateLimit(res.status, text)) {
      throw new GmailError(429, "rate_limited", "Gmail is busy right now. SwipeMail will try again in a moment.");
    }
    throw new GmailError(502, "gmail_error", `Gmail returned an error: ${message}`);
  }
}

/* ---------- parsing ---------- */

interface Part {
  mimeType?: string;
  body?: { data?: string };
  parts?: Part[];
  headers?: { name: string; value: string }[];
}
interface GmailMessage {
  id: string;
  threadId?: string;
  internalDate?: string;
  snippet?: string;
  labelIds?: string[];
  payload?: Part;
}

const decodeB64 = (data: string) => Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

function collect(part: Part | undefined, mime: string, out: string[]) {
  if (!part) return;
  if (part.mimeType === mime && part.body?.data) out.push(decodeB64(part.body.data));
  part.parts?.forEach((p) => collect(p, mime, out));
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n\n")
      .replace(/<[^>]+>/g, ""),
  );
}

/**
 * Turns an email's HTML into a small, safe subset for the hold-to-read preview.
 * Allow-list only: no scripts, styles, forms or iframes. Remote images are dropped (they are how senders
 * track opens), and layout tables are flattened to plain blocks so newsletters read top to bottom.
 */
function sanitizeEmailHtml(raw: string): { html: string; hiddenImages: number } {
  const hiddenImages = (raw.match(/<img\b/gi) ?? []).length;
  const html = sanitizeHtml(raw.slice(0, 60_000), {
    allowedTags: ["p", "br", "div", "span", "a", "b", "strong", "i", "em", "u", "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote", "hr", "pre", "code"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    // Layout tables become blocks.
    transformTags: {
      table: "div",
      tbody: "div",
      thead: "div",
      tfoot: "div",
      tr: "div",
      td: "div",
      th: "div",
      center: "div",
      font: "span",
      h5: "h4",
      h6: "h4",
      a: (tagName, attribs) => ({
        tagName,
        attribs: { href: attribs.href ?? "", target: "_blank", rel: "noopener noreferrer nofollow" },
      }),
    },
    // Drop the content of these entirely, not just the tags.
    nonTextTags: ["style", "script", "textarea", "option", "head", "title"],
    exclusiveFilter: (frame) => {
      // Remove quoted replies and empty blocks.
      if (frame.tag === "blockquote") return true;
      if (frame.tag === "a" && !frame.attribs.href) return true;
      return !frame.text.trim() && ["div", "span", "p", "li", "a", "b", "strong", "i", "em", "u"].includes(frame.tag);
    },
  })
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br /><br />")
    .replace(/(<div>\s*<\/div>\s*)+/gi, "")
    .trim();
  return { html, hiddenImages };
}

/** Plain-text paragraphs for the preview and for summaries. */
function toParagraphs(text: string): string[] {
  const cleaned = text
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith(">"))
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 6000);
  return cleaned
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .slice(0, 14);
}

const PALETTE = ["#5b6cff", "#0f8b8d", "#a23bd8", "#e4572e", "#3a4560", "#d6336c", "#2b8a3e", "#c77d0a"];
function colorFor(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function parseFrom(raw: string) {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const address = (m ? m[2] : raw).trim();
  const name = (m ? m[1] : "").trim() || address.split("@")[0] || "Unknown sender";
  return { name, address };
}

function initialsOf(name: string) {
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function parse(msg: GmailMessage): ApiMail {
  const header = (n: string) => msg.payload?.headers?.find((h) => h.name.toLowerCase() === n)?.value ?? "";
  const { name, address } = parseFrom(header("from"));
  const subject = decodeEntities(header("subject")).trim() || "(No subject)";

  const plain: string[] = [];
  const html: string[] = [];
  collect(msg.payload, "text/plain", plain);
  collect(msg.payload, "text/html", html);
  const text = plain.length ? plain.join("\n\n") : html.map(htmlToText).join("\n\n");
  const body = toParagraphs(text);
  const words = body.join(" ").split(/\s+/).filter(Boolean).length;

  // Rich preview: only when the email actually has an HTML part with readable content.
  let rich: { html: string; hiddenImages: number } | undefined;
  if (html.length) {
    const r = sanitizeEmailHtml(html.join("\n"));
    if (r.html.replace(/<[^>]+>/g, "").trim().length > 20) rich = r;
  }

  const labels = msg.labelIds ?? [];
  const bodyText = body.join(" ");
  return {
    id: msg.id,
    threadId: msg.threadId ?? msg.id,
    name,
    address,
    initials: initialsOf(name),
    color: colorFor(address || name),
    receivedAt: new Date(Number(msg.internalDate) || Date.now()).toISOString(),
    subject,
    summary: summarize(body, subject, msg.snippet ?? ""),
    facts: extractFacts(`${subject}. ${bodyText}`),
    tags: classify({ labels, subject, text: bodyText, address, hasUnsubscribe: Boolean(header("list-unsubscribe")), wordCount: words }),
    body: body.length ? body : [decodeEntities(msg.snippet ?? "") || "(No text content)"],
    ...(rich ? { html: rich.html, hiddenImages: rich.hiddenImages } : {}),
  };
}

/* ---------- public API ---------- */

/** Largest batch a user can choose. The default (25) and the 5 to 50 range live in prefs.ts. */
export const MAX_BATCH = 50;
/** At most this many Gmail requests run at the same time, to stay well inside Gmail's rate limits. */
const CONCURRENCY = 3;
const mailCache = new TtlCache<ApiMail>(10 * 60_000, 600);
const UNREAD_QUERY = "is:unread in:inbox -is:starred";
const STARRED_QUERY = "is:unread is:starred in:inbox";

interface IdPage {
  ids: string[];
  nextPageToken?: string;
}

/** Cheap call: just the message ids for one page of a search (Gmail returns newest first). */
async function listIds(accessToken: string, query: string, size: number, pageToken?: string): Promise<IdPage> {
  const params = new URLSearchParams({ q: query, maxResults: String(size) });
  if (pageToken) params.set("pageToken", pageToken);
  const list = await gmail<{ messages?: { id: string }[]; nextPageToken?: string }>(accessToken, `messages?${params}`);
  return { ids: list.messages?.map((m) => m.id) ?? [], nextPageToken: list.nextPageToken };
}

/** Runs `fn` over `items` with a small number in flight at once, keeping the original order. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/**
 * Messages for the given ids, parsed and sorted newest first.
 * "full" downloads the whole message (needed for the reader). "light" downloads headers and a snippet only,
 * which is much smaller and enough for a list.
 */
export async function fetchMails(accessToken: string, ids: string[], detail: "full" | "light" = "full"): Promise<ApiMail[]> {
  const path =
    detail === "full"
      ? (id: string) => `messages/${id}?format=full`
      : (id: string) => `messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`;
  // Emails do not change once received, so remember the ones already downloaded. Refreshing, reloading and
  // reopening a starred email then cost nothing for messages that were fetched a moment ago.
  const who = accessToken.slice(-16);
  const keyOf = (id: string) => `${detail}:${who}:${id}`;
  const wanted = ids.slice(0, MAX_BATCH);

  const missing = wanted.filter((id) => !mailCache.get(keyOf(id)));
  const fetched = await pool(missing, CONCURRENCY, (id) => gmail<GmailMessage>(accessToken, path(id)));
  fetched.forEach((m) => mailCache.set(keyOf(m.id), detail === "light" ? { ...parse(m), light: true } : parse(m)));

  return wanted
    .map((id) => mailCache.get(keyOf(id)))
    .filter((m): m is ApiMail => !!m)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

/** Unread inbox emails still waiting for a decision (starred ones are kept apart, see starredUnread). */
export async function unreadPage(accessToken: string, size: number, pageToken?: string) {
  const { ids, nextPageToken } = await listIds(accessToken, UNREAD_QUERY, size, pageToken);
  return { mails: await fetchMails(accessToken, ids), nextPageToken };
}

/** Just the ids of the newest page. Used to check for new mail without downloading every message again. */
export async function unreadIds(accessToken: string, size: number) {
  return (await listIds(accessToken, UNREAD_QUERY, size)).ids;
}

/** Emails the user starred with a right swipe: still unread, shown in the Starred tab. */
export async function starredUnread(accessToken: string) {
  const { ids } = await listIds(accessToken, STARRED_QUERY, MAX_BATCH);
  return fetchMails(accessToken, ids, "light");
}

/** Exact number of unread emails in the inbox, as Gmail itself counts them. */
export async function inboxUnreadTotal(accessToken: string): Promise<number> {
  const label = await gmail<{ messagesUnread?: number }>(accessToken, "labels/INBOX");
  return label.messagesUnread ?? 0;
}

const LABELS: Record<MailAction, { add?: string[]; remove?: string[] }> = {
  read: { remove: ["UNREAD"] },
  unread: { add: ["UNREAD"] },
  star: { add: ["STARRED"] },
  unstar: { remove: ["STARRED"] },
  archive: { remove: ["INBOX", "UNREAD"] },
  unarchive: { add: ["INBOX", "UNREAD"] },
  done: { remove: ["STARRED", "UNREAD"] },
};

export async function applyAction(accessToken: string, id: string, action: MailAction): Promise<void> {
  const { add = [], remove = [] } = LABELS[action];
  await gmail(accessToken, `messages/${encodeURIComponent(id)}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds: add, removeLabelIds: remove }),
  }, { urgent: true });
}

export const isMailAction = (v: unknown): v is MailAction => typeof v === "string" && v in LABELS;
