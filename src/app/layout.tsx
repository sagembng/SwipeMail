import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import AppLoader from "@/components/AppLoader";
import BackgroundGlow from "@/components/BackgroundGlow";

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: { default: "SwipeMail", template: "%s · SwipeMail" },
  description: "Clear your unread email by swiping. Left to mark read, right to star.",
};

/** Lets the page use the full phone screen (including behind the notch) and colours the browser bar to match. */
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eff0f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c12" },
  ],
};

/**
 * Applies the saved light/dark choice before first paint, to avoid a flash of the wrong theme.
 * Which account's choice: the demo has its own, the dashboard uses the account that used the app last, and every other
 * page (login, walkthrough) uses the logged-out choice. The key format matches themeStorageKey() in lib/theme.ts.
 * When a different account signs in, the dashboard corrects this right away while the logo loader is still covering the screen.
 */
const themeScript = `try{var p=location.pathname,a=p.indexOf("/demo")===0?"demo":p.indexOf("/dashboard")===0?(localStorage.getItem("swipemail:last-account")||"guest"):"guest",k=function(x){return "swipemail:theme:"+x.trim().toLowerCase()},t=localStorage.getItem(k(a));if(t===null&&a!=="demo"&&a!=="guest")t=localStorage.getItem("swipemail-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppLoader />
        <BackgroundGlow />
        {children}
      </body>
    </html>
  );
}
