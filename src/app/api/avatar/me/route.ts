import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { isGoogleImageHost, sizedGoogleImage } from "@/lib/avatar";
import { getAccessToken } from "@/lib/gmail";

/**
 * GET /api/avatar/me?u=<the signed-in email>
 * The signed-in user's Google profile picture. Fetched on the server so it works even when Google refuses
 * hot-linking from the browser. Uses the picture saved in the session, or asks Google's userinfo endpoint for it.
 *
 * The browser caches this response, so the address must be different for every account. The page adds the email as `u`,
 * and the server refuses to answer for a different email than the one signed in. Without that, signing in as someone
 * else would keep showing the previous person's picture.
 */
const NO_PICTURE = { status: 204, headers: { "Cache-Control": "no-store" } } as const;

async function pictureFor(session: { user?: { image?: string | null } }): Promise<string | null> {
  if (session.user?.image && isGoogleImageHost(session.user.image)) return session.user.image;
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${await getAccessToken()}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const info = (await res.json()) as { picture?: string };
    return info.picture && isGoogleImageHost(info.picture) ? info.picture : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response(null, NO_PICTURE);

  // An address saved by the previous account must not return this account's picture, or the other way round.
  const asked = req.nextUrl.searchParams.get("u")?.toLowerCase();
  if (asked && asked !== session.user.email?.toLowerCase()) return new Response(null, NO_PICTURE);

  const url = await pictureFor(session);
  if (!url) return new Response(null, NO_PICTURE);
  try {
    const res = await fetch(sizedGoogleImage(url), { signal: AbortSignal.timeout(5000), cache: "no-store" });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return new Response(null, NO_PICTURE);
    return new Response(await res.arrayBuffer(), {
      // private: only this browser may keep it. Vary: Cookie: a different signed-in person never reuses it.
      headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600", Vary: "Cookie" },
    });
  } catch {
    return new Response(null, NO_PICTURE);
  }
}
