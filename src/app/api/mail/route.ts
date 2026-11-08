import { NextResponse, type NextRequest } from "next/server";
import { clampBatch } from "@/lib/prefs";
import {
  GmailError,
  fetchMails,
  getAccessToken,
  inboxUnreadTotal,
  starredUnread,
  unreadIds,
  unreadPage,
} from "@/lib/gmail";

/** Seconds this route may run on the host. Retrying a busy Gmail can take several seconds, so allow more than the default. */
export const maxDuration = 30;

const ID = /^[0-9a-f]{8,32}$/i;
const TOKEN = /^[A-Za-z0-9_-]{1,512}$/;
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * All of these accept ?size=5..50 (default 25), the emails per batch.
 * GET /api/mail                      first batch: { mails, nextPageToken, unreadTotal }
 * GET /api/mail?pageToken=T          the next batch: { mails, nextPageToken }
 * GET /api/mail?view=ids             newest ids only, for cheap new-mail checks: { ids, unreadTotal }
 * GET /api/mail?ids=a,b,c            full messages for those ids: { mails }
 * GET /api/mail?view=starred         the Starred tab (light download): { mails }
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  // Emails per batch, chosen in Settings (5 to 50, default 25).
  const size = clampBatch(Number(q.get("size") ?? 25));
  try {
    const token = await getAccessToken();

    const idsParam = q.get("ids");
    if (idsParam !== null) {
      const ids = idsParam.split(",").filter(Boolean);
      if (ids.length > 50 || !ids.every((i) => ID.test(i))) return bad("Invalid ids.");
      return NextResponse.json({ mails: await fetchMails(token, ids) }, { headers: NO_STORE });
    }

    const pageToken = q.get("pageToken");
    if (pageToken !== null) {
      if (!TOKEN.test(pageToken)) return bad("Invalid page token.");
      return NextResponse.json(await unreadPage(token, size, pageToken), { headers: NO_STORE });
    }

    const view = q.get("view");
    if (view === "ids") {
      const [ids, unreadTotal] = await Promise.all([unreadIds(token, size), inboxUnreadTotal(token)]);
      return NextResponse.json({ ids, unreadTotal }, { headers: NO_STORE });
    }
    if (view === "starred") {
      return NextResponse.json({ mails: await starredUnread(token) }, { headers: NO_STORE });
    }

    // Starred emails are fetched separately, only when the Starred tab is opened.
    const [page, unreadTotal] = await Promise.all([unreadPage(token, size), inboxUnreadTotal(token)]);
    return NextResponse.json({ ...page, unreadTotal }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof GmailError) {
      return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
    }
    console.error("GET /api/mail failed", e);
    return NextResponse.json({ error: { code: "gmail_error", message: "Could not load your emails." } }, { status: 500 });
  }
}

const bad = (message: string) => NextResponse.json({ error: { code: "bad_request", message } }, { status: 400 });
