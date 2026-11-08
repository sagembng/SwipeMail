import Link from "next/link";
import { PrefsScope } from "@/lib/prefs-scope";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/site";
import Brand from "./Brand";
import ThemeToggle from "./ThemeToggle";
import s from "./LegalPage.module.css";

/** Shared frame for the Privacy Policy and Terms of Service: public, readable, no sign-in. */
export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <PrefsScope account="guest">
      <main className={s.page}>
        <header className={s.top}>
          <Brand href="/" />
          <ThemeToggle />
        </header>

        <article className={`${s.doc} glass`}>
          <h1>{title}</h1>
          <p className={s.updated}>Last updated: {LEGAL_UPDATED}</p>
          {children}
        </article>

        <nav className={s.foot} aria-label="Legal">
          <Link href="/">Home</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
        </nav>
      </main>
    </PrefsScope>
  );
}

/** "Contact: name@example.com" as a mail link, or a plain sentence while no CONTACT_EMAIL has been set. */
export function ContactLine() {
  return CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  ) : (
    <span>the SwipeMail project page on GitHub</span>
  );
}
