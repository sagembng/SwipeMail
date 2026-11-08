import type { Metadata } from "next";
import Link from "next/link";
import { googleConfigured, signIn } from "@/auth";
import Brand from "@/components/Brand";
import { PrefsScope } from "@/lib/prefs-scope";
import LoaderForm from "@/components/LoaderForm";
import ThemeToggle from "@/components/ThemeToggle";
import { CheckIcon, GoogleIcon, ShieldIcon, SparkIcon, StarIcon } from "@/components/icons";
import s from "./login.module.css";

export const metadata: Metadata = { title: "Sign in" };

// This page reads the request's query string (?error=...), so it is rendered per request, not prerendered.
export const instant = false;

const MESSAGES: Record<string, string> = {
  AccessDenied: "Access was not granted. SwipeMail needs permission to read your mail and mark it read or starred.",
  OAuthCallbackError: "Google sign-in was cancelled or failed. Please try again.",
  RefreshTokenError: "Your Google session expired. Please sign in again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  async function signInAction() {
    "use server";
    await signIn("google", { redirectTo: "/dashboard" });
  }

  const message = !googleConfigured
    ? "Google sign-in is not set up yet. Add your Google keys to .env.local (see docs/google-setup.md), or try the demo."
    : error
      ? (MESSAGES[error] ?? "Something went wrong signing in. Please try again.")
      : null;

  return (
    <PrefsScope account="guest">
    <main className={s.page}>
      <header className={s.top}>
        <Brand href="/login" />
        <ThemeToggle />
      </header>

      <section className={s.grid}>
        <div className={s.hero}>
          <h1>
            Swipe through
            <br />
            your inbox.
          </h1>
          <p className={s.lead}>
            SwipeMail turns your unread emails into a clean stack of cards. Zero inbox fatigue. Clear 20 unreads before your coffee gets cold.
          </p>

          <ul className={s.points}>
            <li className="glass">
              <span className={`${s.dot} ${s.dRead}`}>
                <CheckIcon />
              </span>
              <span>
                <b>Swipe left</b>
                <small>Mark as read</small>
              </span>
            </li>
            <li className="glass">
              <span className={`${s.dot} ${s.dStar}`}>
                <StarIcon />
              </span>
              <span>
                <b>Swipe right</b>
                <small>Star, keep unread</small>
              </span>
            </li>
            <li className="glass">
              <span className={`${s.dot} ${s.dPrimary}`}>
                <SparkIcon />
              </span>
              <span>
                <b>Hold</b>
                <small>Preview the full email</small>
              </span>
            </li>
          </ul>

          <div className={s.preview} aria-hidden="true">
            <div className={`${s.pcard} ${s.p3}`} />
            <div className={`${s.pcard} ${s.p2}`} />
            <div className={`${s.pcard} ${s.p1}`}>
              <div className={s.prow}>
                <i className={s.pav}>PN</i>
                <div>
                  <b>Priya Nair</b>
                  <small>8:12 AM</small>
                </div>
                <span className="tag tagAct">
                  <i />
                  Action needed
                </span>
              </div>
              <strong>Q3 budget sign-off needed by Friday</strong>
              <span className={s.line} />
              <span className={`${s.line} ${s.short}`} />
            </div>
          </div>
        </div>

        <div className={s.authCol}>
          <p className={`${s.badge} glass`}>
            <span aria-hidden="true">✨</span> Optimized for Gmail &amp; Google Workspace
          </p>

        <div className={`${s.card} glass`}>
          <h2>Welcome back</h2>
          <p className={s.sub}>Sign in to see what is waiting in your inbox.</p>

          {message && (
            <p className={s.alert} role="alert">
              {message}
            </p>
          )}

          <LoaderForm action={signInAction} message="Signing you in…">
            <button type="submit" className={`btn ${s.google}`} disabled={!googleConfigured}>
              <GoogleIcon width={20} height={20} />
              Continue with Google
            </button>
          </LoaderForm>

          <div className={s.or}>
            <span>or</span>
          </div>

          <Link href="/walkthrough" className={`btn btnPrimary ${s.demo}`}>
            Start interactive walkthrough
          </Link>
          <p className={s.hintLine}>Takes about 60 seconds. No sign-in needed.</p>

          <p className={s.privacy}>
            <ShieldIcon />
            <span>
              SwipeMail only changes the read, starred and archived status of your emails. Message bodies are never stored.
            </span>
          </p>

          <details className={s.warn}>
            <summary>Google shows a warning screen?</summary>
            <p>
              That is expected. SwipeMail is a personal project that Google has not formally reviewed, so Google shows &ldquo;Google hasn&apos;t verified this app&rdquo;
              to everyone. To continue, click <strong>Advanced</strong>, then <strong>Go to this site (unsafe)</strong>, then tick the Gmail box and press{" "}
              <strong>Continue</strong>. You can remove access any time in your Google Account.
            </p>
          </details>
        </div>
        </div>
      </section>

      <footer className={s.foot}>
        <span>© 2026 SwipeMail</span>
        <nav className={s.legal} aria-label="Legal">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
        </nav>
      </footer>
    </main>
    </PrefsScope>
  );
}
