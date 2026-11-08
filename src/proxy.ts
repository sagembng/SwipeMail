import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Route guard (Next 16 "proxy", formerly middleware).
 * - /dashboard needs a signed-in user whose Google token is still usable.
 * - /login sends already signed-in users straight to the dashboard.
 * The dashboard page checks the session again on the server, so this is a convenience layer, not the only gate.
 */
export default auth((req) => {
  const signedIn = Boolean(req.auth?.user) && !req.auth?.error;
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard") && !signedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (pathname === "/login" && signedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
