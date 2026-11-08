/**
 * Auth.js names its login cookie differently on a secure site: "__Secure-authjs.session-token" on https,
 * "authjs.session-token" on http (localhost). Reading the login yourself (getToken) must look for the right name,
 * so this works out whether the request came in over https. Pure, so it is unit tested (cookies.test.ts).
 */
export function isSecureRequest(headers: Headers, authUrl: string | undefined = undefined): boolean {
  // Behind a host such as Vercel the app sees plain http internally, and the original protocol is in this header.
  // It may list several values ("https,http"); the first one is what the browser used.
  const forwarded = headers.get("x-forwarded-proto")?.split(",")[0].trim().toLowerCase();
  if (forwarded) return forwarded === "https";
  return Boolean(authUrl?.toLowerCase().startsWith("https://"));
}
