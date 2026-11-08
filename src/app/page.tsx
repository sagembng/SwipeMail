import type { Metadata } from "next";
import LoginPage from "./login/page";

// The home page. Google needs a home page address that opens directly (no redirect) and links to the privacy policy,
// so "/" shows the landing page itself instead of redirecting to /login. Both addresses show the same page.
export const metadata: Metadata = {
  title: { absolute: "SwipeMail: clear your inbox by swiping" },
  description: "SwipeMail turns your unread emails into a clean stack of cards. Swipe to mark read, star, archive or snooze.",
};

// The page reads the request's query string (?error=...), so it is rendered per request.
export const instant = false;

export default LoginPage;
