import { NextResponse, type NextRequest } from "next/server";
import { GmailError, applyAction, getAccessToken, isMailAction } from "@/lib/gmail";

const fail = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

/**
 * POST /api/mail/:id  { "action": "read" | "unread" | "star" | "unstar" }
 * read removes UNREAD, star adds STARRED, and the other two undo those.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // The session cookie is sent automatically, so only accept requests that come from this site.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return fail(403, "bad_request", "Cross-site request blocked.");
  }

  const { id } = await ctx.params;
  if (!/^[0-9a-f]{8,32}$/i.test(id)) return fail(400, "bad_request", "Invalid message id.");

  const body = await req.json().catch(() => null);
  if (!body || !isMailAction(body.action)) return fail(400, "bad_request", "Unknown action.");

  try {
    const token = await getAccessToken();
    await applyAction(token, id, body.action);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof GmailError) return fail(e.status, e.code, e.message);
    console.error("POST /api/mail/[id] failed", e);
    return fail(500, "gmail_error", "Could not update that email.");
  }
}
