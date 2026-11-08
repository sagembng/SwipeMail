"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { HOTKEY_LABELS, HOTKEY_ORDER, keyLabel } from "@/lib/prefs";
import { usePrefs } from "@/lib/prefs-store";
import { ArchiveIcon, CheckIcon, ClockIcon, StarIcon } from "./icons";
import s from "./HelpDialog.module.css";

interface Step {
  title: string;
  body: ReactNode;
  visual: ReactNode;
}

function buildSteps(batchSize: number, keys: Record<string, string>): Step[] {
  return [
  {
    title: "Clear your inbox by swiping",
    body: (
      <p>
        SwipeMail gathers your unread emails into a stack of cards. Each card shows who it is from, a short summary and the key details, such as a deadline. Decide
        with a swipe, and the next email is ready.
      </p>
    ),
    visual: (
      <div className={s.stackArt} aria-hidden="true">
        <i className={s.c3} />
        <i className={s.c2} />
        <i className={s.c1}>
          <b />
          <u />
          <u />
        </i>
      </div>
    ),
  },
  {
    title: "Four ways to swipe",
    body: (
      <ul className={s.dirs}>
        <li>
          <span className={`${s.chip} ${s.read}`}>
            <CheckIcon />
          </span>
          <div>
            <b>Left: mark read</b>
            <small>Gone from your unread list in Gmail.</small>
          </div>
        </li>
        <li>
          <span className={`${s.chip} ${s.star}`}>
            <StarIcon />
          </span>
          <div>
            <b>Right: star</b>
            <small>Stays unread so you come back to it. Find it in the Starred tab.</small>
          </div>
        </li>
        <li>
          <span className={`${s.chip} ${s.arch}`}>
            <ArchiveIcon />
          </span>
          <div>
            <b>Up: archive</b>
            <small>Leaves your inbox and is marked read. Still searchable in Gmail.</small>
          </div>
        </li>
        <li>
          <span className={`${s.chip} ${s.snooze}`}>
            <ClockIcon />
          </span>
          <div>
            <b>Down: snooze</b>
            <small>Hidden until 3 PM today, or 8 AM tomorrow if it is already afternoon.</small>
          </div>
        </li>
      </ul>
    ),
    visual: (
      <div className={s.pad} aria-hidden="true">
        <span className={`${s.arrow} ${s.up}`}>↑</span>
        <span className={`${s.arrow} ${s.left}`}>←</span>
        <i className={s.mini} />
        <span className={`${s.arrow} ${s.right}`}>→</span>
        <span className={`${s.arrow} ${s.down}`}>↓</span>
      </div>
    ),
  },
  {
    title: "Read the whole email",
    body: (
      <p>
        <b>Press and hold</b> a card (or press <kbd>Space</kbd>) to open the full email. Scroll to read it, then tap <b>Close</b> or press <kbd>Esc</kbd>. Images are
        hidden to protect your privacy, and <b>Open in Gmail</b> opens the original if you need it.
      </p>
    ),
    visual: (
      <div className={s.readerArt} aria-hidden="true">
        <i />
        <u />
        <u />
        <u />
        <u className={s.short} />
      </div>
    ),
  },
  {
    title: "You stay in control",
    body: (
      <>
        <p>
          Made a mistake? <b>Undo</b> brings the last card back and reverses the change in Gmail. To keep things quick, SwipeMail loads <b>{batchSize} emails at a
          time</b>. When you finish a batch, load the next one, or press <b>Refresh</b> to check for new mail. You can change the batch size, and every
          keyboard shortcut, in <b>Settings</b>.
        </p>
        <div className={s.keys}>
          {HOTKEY_ORDER.map((a) => (
            <span key={a}>
              <kbd>{keyLabel(keys[a])}</kbd> {HOTKEY_LABELS[a]}
            </span>
          ))}
        </div>
      </>
    ),
    visual: (
      <div className={s.undoArt} aria-hidden="true">
        <b>Z</b>
      </div>
    ),
  },
];
}

interface Props {
  onClose: () => void;
}

/** A short welcome tour. Opens on the first visit and any time from the ? button or the settings menu. */
export default function HelpDialog({ onClose }: Props) {
  const prefs = usePrefs();
  const STEPS = buildSteps(prefs.batchSize, prefs.hotkeys);
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setStep((x) => Math.min(3, x + 1));
      if (e.key === "ArrowLeft") setStep((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cur = STEPS[step];

  return (
    <div className={s.overlay} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="help-title">
        <button type="button" className={s.x} onClick={onClose} aria-label="Close help">
          ×
        </button>
        <div className={s.visual}>{cur.visual}</div>
        <div className={s.content} key={step}>
          <small className={s.count}>
            {step + 1} of {STEPS.length}
          </small>
          <h2 id="help-title">{cur.title}</h2>
          <div className={s.body}>{cur.body}</div>
        </div>
        <div className={s.foot}>
          <div className={s.dots} aria-hidden="true">
            {STEPS.map((_, i) => (
              <i key={i} className={i === step ? s.on : undefined} />
            ))}
          </div>
          <div className={s.btns}>
            {step > 0 ? (
              <button type="button" className="btn" onClick={() => setStep(step - 1)}>
                Back
              </button>
            ) : (
              <button type="button" className="btn btnText" onClick={onClose}>
                Skip
              </button>
            )}
            <button ref={primary} type="button" className="btn btnPrimary" onClick={() => (last ? onClose() : setStep(step + 1))}>
              {last ? "Start swiping" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
