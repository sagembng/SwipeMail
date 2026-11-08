"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import Brand from "@/components/Brand";
import SwipeDeck, { type Decision } from "@/components/SwipeDeck";
import ThemeToggle from "@/components/ThemeToggle";
import LoaderForm from "@/components/LoaderForm";
import { GoogleIcon } from "@/components/icons";
import { markOnboarded } from "@/components/onboarding";
import { keyLabel } from "@/lib/prefs";
import { usePrefs } from "@/lib/prefs-store";
import { MAILS, type Mail } from "@/lib/mock";
import s from "./walkthrough.module.css";

/** Two sample emails: the first is previewed and swiped left, the second is swiped right. */
const SAMPLES: Mail[] = [MAILS[0], MAILS[1]];

interface Props {
  /** Server action that starts Google sign-in. Missing when Google keys are not configured. */
  connectAction?: () => Promise<void>;
}

/**
 * Step 1  hold to preview (swiping is locked until the preview has been opened and closed)
 * Step 2  swipe left to mark read (only that direction works)
 * Step 3  swipe right to star (only that direction works)
 * Then    the "Inbox Zero achieved" screen.
 * The current step is worked out from what the person has done, so there is no extra state to keep in sync.
 */
export default function Walkthrough({ connectAction }: Props) {
  const prefs = usePrefs();
  const [items, setItems] = useState<Mail[]>(SAMPLES);
  const [swiped, setSwiped] = useState(0);
  const [previewed, setPreviewed] = useState(false); // the reader was opened at least once
  const [reading, setReading] = useState(false); // the reader is open right now
  const [runKey, setRunKey] = useState(0); // changes on "Replay" to reset the deck

  const onPeekChange = useCallback((open: boolean) => {
    setReading(open);
    if (open) setPreviewed(true);
  }, []);

  const onDecide = useCallback(
    (id: string) => {
      if (items.length <= 1) markOnboarded(); // finished: do not show the tour again on the demo
      setItems((prev) => prev.filter((m) => m.id !== id));
      setSwiped((n) => n + 1);
    },
    [items.length],
  );

  const holdDone = previewed && !reading;
  const step = swiped >= SAMPLES.length ? 4 : swiped === 1 ? 3 : holdDone ? 2 : 1;
  // Memoised so the deck sees the same array until the step changes.
  const allowed = useMemo<Decision[]>(() => (step === 2 ? ["read"] : step === 3 ? ["star"] : []), [step]);

  function replay() {
    setItems(SAMPLES);
    setSwiped(0);
    setPreviewed(false);
    setReading(false);
    setRunKey((k) => k + 1);
  }

  return (
    <main className={s.page}>
      <header className={s.top}>
        <Brand href="/login" />
        <div className={s.right}>
          <ThemeToggle />
          <Link href="/login" className={`${s.skip} glass`}>
            Skip
          </Link>
        </div>
      </header>

      {step < 4 ? (
        <section className={s.stage} aria-label="Interactive walkthrough">
          <ol className={s.dots} aria-label="Progress">
            {[1, 2, 3].map((n) => (
              <li key={n} className={n < step ? s.done : n === step ? s.on : undefined} aria-current={n === step ? "step" : undefined}>
                <i />
                <span>{["Preview", "Mark read", "Star"][n - 1]}</span>
              </li>
            ))}
          </ol>

          <div className={`${s.tip} glass`} role="status" aria-live="polite" key={`${step}-${reading}`}>
            <small>Step {step} of 3</small>
            {step === 1 && (
              <>
                <b>{reading ? "Nice! Now close the preview." : "Hold down to preview the full email."}</b>
                <span>
                  {reading
                    ? "Press Close, or press Esc, to continue."
                    : `Press and hold the card, or press ${keyLabel(prefs.hotkeys.peek)}. Scroll to read, then close it.`}
                </span>
              </>
            )}
            {step === 2 && (
              <>
                <b>Swipe left to mark as read.</b>
                <span>Drag the card to the left, or press {keyLabel(prefs.hotkeys.read)}.</span>
              </>
            )}
            {step === 3 && (
              <>
                <b>Swipe right to star and keep unread.</b>
                <span>Drag the card to the right, or press {keyLabel(prefs.hotkeys.star)}. Starred emails wait for you in the Starred tab.</span>
              </>
            )}
          </div>

          <div className={s.deckWrap}>
            <SwipeDeck
              key={`deck-${runKey}`}
              items={items}
              keyboard
              keymap={prefs.hotkeys}
              haptics={prefs.haptics}
              allowed={allowed}
              onPeekChange={onPeekChange}
              onDecide={onDecide}
              empty={<span />}
            />
            {/* Decorative cue showing what to do. Hidden while the reader is open. */}
            {!reading && (
              <span className={`${s.cue} ${step === 1 ? s.cueHold : step === 2 ? s.cueLeft : s.cueRight}`} aria-hidden="true" key={`cue-${step}`} />
            )}
          </div>

          <p className={s.note}>Sample emails. Nothing here touches your inbox.</p>
        </section>
      ) : (
        <section className={`${s.finish} glass`} aria-live="polite">
          <Image src="/logo.png" alt="" width={900} height={371} className={s.finishLogo} />
          <h1>Inbox Zero achieved! 🎉</h1>
          <p>That is the whole idea: preview, swipe, done. Connect your Gmail to clear your real unread emails the same way.</p>

          {connectAction ? (
            <LoaderForm action={connectAction} message="Signing you in…" className={s.connectForm}>
              <button type="submit" className={`btn btnPrimary ${s.cta}`}>
                <GoogleIcon width={20} height={20} /> Connect with Google
              </button>
            </LoaderForm>
          ) : (
            <Link href="/login" className={`btn btnPrimary ${s.cta}`}>
              <GoogleIcon width={20} height={20} /> Connect with Google
            </Link>
          )}

          <div className={s.links}>
            <Link href="/demo">Explore the full demo</Link>
            <button type="button" onClick={replay}>
              Replay walkthrough
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
