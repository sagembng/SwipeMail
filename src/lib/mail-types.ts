import type { TagKind } from "./mock";

/** An unread email as returned by /api/mail. Dates stay ISO strings; the browser formats them in the user's time zone. */
export interface ApiMail {
  id: string;
  /** Gmail's web addresses are built from the conversation (thread) id, which differs from the message id for replies. */
  threadId: string;
  name: string;
  address: string;
  initials: string;
  color: string;
  receivedAt: string;
  subject: string;
  summary: string;
  tags: { kind: TagKind; label: string }[];
  /** Details worth scanning for: a deadline, amounts. */
  facts: { label: string; tone: "urgent" | "neutral" }[];
  /** Plain-text paragraphs, always present. */
  body: string[];
  /** Sanitised HTML version of the email (no scripts, styles or remote images). Absent for plain-text emails. */
  html?: string;
  /** How many remote images were removed from the HTML. */
  hiddenImages?: number;
  /** True when only headers and a snippet were downloaded (the Starred list). Fetch the full email before reading it. */
  light?: boolean;
}

/**
 * read      remove UNREAD
 * unread    add UNREAD (undo of read)
 * star      add STARRED, stays unread
 * unstar    remove STARRED (undo of star)
 * archive   remove INBOX and UNREAD
 * unarchive add INBOX and UNREAD (undo of archive)
 * done      remove STARRED and UNREAD (finish with a starred email)
 * Snooze has no Gmail action: it is stored in the browser.
 */
export type MailAction = "read" | "unread" | "star" | "unstar" | "archive" | "unarchive" | "done";

export interface ApiError {
  code: "unauthenticated" | "reauth" | "api_disabled" | "scope" | "rate_limited" | "gmail_error" | "bad_request";
  message: string;
}
