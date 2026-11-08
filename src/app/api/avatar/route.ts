import type { NextRequest } from "next/server";
import { avatarCandidates, isEmail } from "@/lib/avatar";

/**
 * GET /api/avatar?email=someone@example.com
 * A picture for an email sender: their Gravatar if they have one, otherwise their company's logo.
 * SwipeMail's server fetches it, so the browser never contacts those services directly (no IP or sender leak),
 * and the browser can cache the result. Answers 204 (no content) when there is nothing, and the UI shows initials instead.
 */
const MAX_BYTES = 200_000;
const DAY = 86_400;

const cacheHeaders = (ok: boolean) => ({
  "Cache-Control": `public, max-age=${DAY}, stale-while-revalidate=${DAY * 7}`,
  ...(ok ? {} : { "Content-Type": "text/plain" }),
});

export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!isEmail(email)) return new Response(null, { status: 400 });

  for (const url of avatarCandidates(email)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000), redirect: "follow", cache: "force-cache" });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/") || type.includes("svg")) continue;
      const bytes = await res.arrayBuffer();
      if (bytes.byteLength < 100 || bytes.byteLength > MAX_BYTES) continue;
      return new Response(bytes, { headers: { "Content-Type": type, ...cacheHeaders(true) } });
    } catch {
      /* try the next source */
    }
  }
  // 204 = "nothing to show". The page falls back to initials, and the browser console stays free of red 404 errors.
  return new Response(null, { status: 204, headers: cacheHeaders(false) });
}
