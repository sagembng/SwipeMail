/**
 * Free, offline "smart" summaries. No AI and no network: plain text rules.
 * Pure functions only, so they can be unit tested (see summarize.test.ts).
 */

export type TagKind = "act" | "promo" | "urgent" | "fyi" | "plain";
export interface Tag {
  kind: TagKind;
  label: string;
}
export interface Fact {
  label: string;
  /** "urgent" is used for deadlines that are today or tomorrow. */
  tone: "urgent" | "neutral";
}

/* ---------- cleaning ---------- */

const SIGN_OFF = /^(thanks|thank you|thanks again|many thanks|best|best regards|kind regards|warm regards|regards|cheers|sincerely|yours|take care|talk soon|sent from my .*|get outlook for .*)[\s,.!-]*$/i;
const GREETING_ONLY = /^(hi|hello|hey|dear|good (morning|afternoon|evening)|greetings)\b[^.!?\n]{0,40}[,!:\-]?\s*$/i;
const GREETING_PREFIX = /^(hi|hello|hey|dear)\s+[\p{L}][\p{L} .'’-]{0,30}[,!:]\s*/iu;
const FOOTER =
  /unsubscribe|view (this email |it )?in (your )?browser|you are receiving this|you(’|')re receiving this|all rights reserved|©|privacy policy|terms of (service|use)|this (e-?mail|message)( and any attachments)? (is|are|may be) (confidential|intended)|manage (your )?(email )?(preferences|subscriptions)|add us to your address book|sent (to|by) .{0,40} because/i;

const urlChars = (s: string) => (s.match(/https?:\/\/\S+/g) ?? []).join("").length;

/** Removes greetings, sign-offs, quoted replies, link-only lines and newsletter footers. Keeps the real content. */
export function cleanParagraphs(paragraphs: string[]): string[] {
  const out: string[] = [];
  for (const raw of paragraphs) {
    let p = raw.trim();
    if (!p) continue;
    // Everything after a sign-off or a "-- " signature divider is signature, not content.
    if (p === "--" || /^-- ?$/.test(p) || (out.length && SIGN_OFF.test(p))) break;
    if (/^on .{5,80} wrote:$/i.test(p) || /^from:\s.+sent:\s/i.test(p)) break;
    if (GREETING_ONLY.test(p)) continue;
    p = p.replace(GREETING_PREFIX, "");
    if (FOOTER.test(p) && p.length < 500) continue;
    if (/^\[(image|cid)[^\]]*\]$/i.test(p)) continue;
    if (p.length > 0 && urlChars(p) / p.length > 0.6) continue;
    p = p.replace(/https?:\/\/\S+/g, "").replace(/\s{2,}/g, " ").trim();
    if (p) out.push(p);
  }
  return out;
}

/* ---------- facts ---------- */

const WEEKDAY = "(?:mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat|sun)[a-z]*";
const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DATE = `(?:(?:next\\s+|this\\s+)?${WEEKDAY}|tomorrow|today|tonight|end of (?:the )?(?:day|week|month)|eod|eow|${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?|\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH})`;
const TIME = "\\d{1,2}(?::\\d{2})?\\s?(?:am|pm)";
const DEADLINE = new RegExp(
  `\\b(by|before|due(?:\\s+on|\\s+by)?|deadline(?:\\s+is|\\s+of)?|until|closes?(?:\\s+on)?|ends?(?:\\s+on)?|expires?(?:\\s+on)?)\\s+(${DATE})(?:\\s*(?:at|,)?\\s*(${TIME}))?`,
  "i",
);
const MONEY = /[$€£]\s?\d(?:[\d,]*\d)?(?:\.\d{2})?/g;

const titleCase = (s: string) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase());

/** Pulls out the details a person scans for: a deadline and money amounts. */
export function extractFacts(text: string): Fact[] {
  const facts: Fact[] = [];
  const d = text.match(DEADLINE);
  if (d) {
    const verb = /clos|end|expir|until/i.test(d[1]) ? "Ends" : "Due";
    const date = d[2].toLowerCase().replace(/^eod$/, "end of day").replace(/^eow$/, "end of week");
    const time = d[3] ? " " + d[3].toUpperCase().replace(/\s+/g, " ").replace(/(\d)(AM|PM)/, "$1 $2") : "";
    facts.push({ label: `${verb} ${titleCase(date)}${time}`, tone: /today|tonight|tomorrow|end of day|eod/i.test(date) ? "urgent" : "neutral" });
  }
  const money = [...new Set((text.match(MONEY) ?? []).map((m) => m.replace(/\s/g, "")))].slice(0, 2);
  for (const m of money) facts.push({ label: m, tone: "neutral" });
  return facts.slice(0, 3);
}

/* ---------- summary ---------- */

const STOP = new Set("a an and are as at be but by for from has have i in is it its of on or our that the their this to was we were will with you your".split(" "));
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]{3,}/g)?.filter((w) => !STOP.has(w)) ?? []);

const ASK = /\b(need|needs|needed|please|approve|approval|confirm|must|required|decision|sign[- ]?off|let me know|can you|could you|would you|reply|respond|rsvp)\b/i;
const BOILER = /\b(unsubscribe|click here|view (in|this)|trouble viewing|follow us|download (the )?app|do not reply|no-?reply)\b/i;

function scoreSentence(s: string, index: number, subject: Set<string>): number {
  let score = 0;
  if (s.length < 25) score -= 3;
  else if (s.length <= 220) score += 1;
  else score -= 1;
  score += Math.max(0, 3 - index) * 0.8; // earlier is better
  if (ASK.test(s)) score += 2.5;
  if (DEADLINE.test(s)) score += 2;
  if (/[$€£]\s?\d/.test(s)) score += 1.5;
  if (/\d/.test(s)) score += 0.5;
  if (s.includes("?")) score += 1.5;
  if (BOILER.test(s)) score -= 5;
  // A sentence that only repeats the subject adds nothing; some overlap is fine.
  const w = words(s);
  if (w.size && subject.size) {
    const shared = [...w].filter((x) => subject.has(x)).length;
    const repeatsSubject = shared / w.size;
    if (repeatsSubject > 0.8) score -= 3;
    else score += Math.min(1.5, (shared / subject.size) * 1.5);
  }
  return score;
}

function shorten(s: string, max = 240): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ") > 120 ? cut.lastIndexOf(" ") : cut.length).trimEnd() + "…";
}

/** Picks the one or two most informative sentences, in their original order. */
export function summarize(paragraphs: string[], subject: string, fallback: string): string {
  const cleaned = cleanParagraphs(paragraphs);
  const sentences = cleaned
    .join(" ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 14);
  if (!sentences.length) return shorten(fallback.trim()) || "(No text content)";

  const subj = words(subject);
  const ranked = sentences.map((s, i) => ({ s, i, score: scoreSentence(s, i, subj) })).sort((a, b) => b.score - a.score);
  const picked = [ranked[0]];
  const second = ranked[1];
  if (second && second.score > ranked[0].score - 2.5 && ranked[0].s.length + second.s.length < 230) picked.push(second);
  return shorten(
    picked
      .sort((a, b) => a.i - b.i)
      .map((p) => p.s)
      .join(" "),
  );
}

/* ---------- tags ---------- */

export interface ClassifyInput {
  labels: string[];
  subject: string;
  text: string;
  address: string;
  hasUnsubscribe: boolean;
  wordCount: number;
}

const AUTOMATED = /(no-?reply|do-?not-?reply|notifications?|mailer|bounces?|alerts?|receipts?|billing|invoices?|orders?|payments?|statements?)@/i;

export function classify(i: ClassifyInput): Tag[] {
  const hay = `${i.subject}\n${i.text.slice(0, 1500)}`;
  const automated = AUTOMATED.test(i.address);
  const readTime: Tag = { kind: "plain", label: `${Math.max(1, Math.round(i.wordCount / 200))} min read` };
  const has = (label: string) => i.labels.includes(label);
  const has_ = (re: RegExp) => re.test(hay);

  let main: Tag;
  let extra: Tag | null = null;

  if (has_(/\b(security alert|suspicious|unusual (sign-in|activity)|password (was )?(reset|changed)|new sign-in|verify your (identity|account))\b/i)) {
    main = { kind: "urgent", label: "Security" };
  } else if (has("CATEGORY_PROMOTIONS") || (i.hasUnsubscribe && has_(/\b(sale|\d+% off|discount|deal|coupon|limited time|free shipping)\b/i))) {
    main = { kind: "promo", label: "Promo" };
  } else if (has_(/\b(verification code|one-time (code|password)|security code|your code is|\botp\b)\b/i)) {
    main = { kind: "fyi", label: "Code" };
  } else if (automated && has_(/\b(receipt|invoice|payment (received|confirmation)|order confirmation|your order|shipped|delivered|payout|statement|renewal)\b/i)) {
    main = { kind: "fyi", label: "Receipt" };
  } else if (has_(/\b(invitation:|invited you|reschedul|rsvp|zoom|google meet|calendar invite)\b/i) || /\bmeeting\b/i.test(i.subject)) {
    main = { kind: "act", label: "Meeting" };
  } else {
    const urgent = has_(/\b(urgent|asap|immediately|time[- ]sensitive|action required|final notice)\b/i);
    const asks = ASK.test(hay) || DEADLINE.test(hay) || i.subject.includes("?") || /\?/.test(i.text.slice(0, 600));
    if (urgent) {
      main = { kind: "urgent", label: "Urgent" };
      extra = { kind: "act", label: "Action needed" };
    } else if (asks && !(automated && !DEADLINE.test(hay))) {
      main = { kind: "act", label: "Action needed" };
    } else if (i.hasUnsubscribe || has("CATEGORY_UPDATES") || has("CATEGORY_FORUMS") || has("CATEGORY_SOCIAL")) {
      main = { kind: "fyi", label: "Update" };
    } else {
      main = { kind: "fyi", label: "FYI" };
    }
  }
  return extra ? [main, extra, readTime].slice(0, 3) : [main, readTime];
}
