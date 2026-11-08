import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";

/**
 * gmail.modify is the smallest scope that lets SwipeMail change labels (UNREAD, STARRED, INBOX). Google's description of it
 * is broad (it also allows composing and sending), but SwipeMail's code only reads messages and changes those labels.
 * It is a Google "restricted" scope: an unverified app can have up to 100 users (test users, or anyone once published),
 * and more than that needs Google's verification.
 */
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify";

/** True once the Google OAuth client id and secret are in .env.local. */
export const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_GOOGLE_ID!,
        client_secret: process.env.AUTH_GOOGLE_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken!,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return {
      ...token,
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
      // Google only returns a new refresh token sometimes; keep the old one otherwise.
      refreshToken: data.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshTokenError" };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope: `openid email profile ${GMAIL_SCOPE}`,
          // offline + consent makes Google return a refresh token, so SwipeMail can keep working after the hour is up.
          access_type: "offline",
          // select_account: always show the account chooser, so another Gmail account can be picked.
          // consent: makes Google return a refresh token every time.
          prompt: "select_account consent",
        },
      },
    }),
  ],
  // Tokens live in Auth.js's encrypted, httpOnly session cookie. They are never sent to client-side code.
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async jwt({ token, account }) {
      // First sign-in: keep Google's tokens.
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        };
      }
      // Still valid (with a minute to spare).
      if (token.expiresAt && Date.now() / 1000 < token.expiresAt - 60) return token;
      if (!token.refreshToken) return { ...token, error: "RefreshTokenError" };
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.error = token.error;
      return session;
    },
  },
});
