"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BATCH_DEFAULT,
  BATCH_MAX,
  BATCH_MIN,
  BATCH_STEP,
  DEFAULT_HOTKEYS,
  HOTKEY_LABELS,
  HOTKEY_ORDER,
  assignHotkey,
  keyLabel,
  type HotkeyAction,
  type Prefs,
} from "@/lib/prefs";
import { usePrefsAccount } from "@/lib/prefs-scope";
import { savePrefs, usePrefs } from "@/lib/prefs-store";
import { UserAvatar } from "./Avatars";
import LoaderForm from "./LoaderForm";
import ThemeToggle from "./ThemeToggle";
import { CheckIcon, LogoutIcon } from "./icons";
import s from "./SettingsMenu.module.css";

interface Props {
  name: string;
  email: string;
  initials: string;
  demo: boolean;
  /** Server action that signs the user out. Not used in demo mode. */
  signOutAction?: () => Promise<void>;
}

const canVibrate = () => typeof navigator !== "undefined" && "vibrate" in navigator;

const sameHotkeys = (a: Prefs["hotkeys"], b: Prefs["hotkeys"]) => HOTKEY_ORDER.every((k) => a[k] === b[k]);

/** One button for everything account-related: profile, connection, theme, emails per batch, shortcuts, sign out. */
export default function SettingsMenu({ name, email, initials, demo, signOutAction }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const saved = usePrefs();
  const prefsAccount = usePrefsAccount();

  // Edits to batch size and shortcuts are a draft until "Save changes" is pressed.
  const [draft, setDraft] = useState<Prefs | null>(null);
  const shown = draft ?? saved;
  const dirty = draft !== null && (draft.batchSize !== saved.batchSize || draft.haptics !== saved.haptics || !sameHotkeys(draft.hotkeys, saved.hotkeys));
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef(0);

  // Shortcut being remapped: the next key pressed becomes its new key.
  const [listening, setListening] = useState<HotkeyAction | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      // Capture phase: nothing else (including the menu's own Escape handler) sees this key.
      e.preventDefault();
      e.stopImmediatePropagation();
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return; // wait for the real key
      if (e.key === "Escape") {
        setListening(null);
        setKeyError(null);
        return;
      }
      const result = assignHotkey(shown.hotkeys, listening, e.key);
      if (result.ok) {
        setDraft({ ...shown, hotkeys: result.hotkeys });
        setListening(null);
        setKeyError(null);
      } else {
        setKeyError(result.reason);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listening, shown]);

  useEffect(() => () => window.clearTimeout(savedTimer.current), []);

  function save() {
    if (!draft) return;
    savePrefs(prefsAccount, draft);
    setDraft(null);
    setListening(null);
    setKeyError(null);
    setJustSaved(true);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setJustSaved(false), 2200);
  }

  function discard() {
    setDraft(null);
    setListening(null);
    setKeyError(null);
  }

  const shortcutsAreDefault = sameHotkeys(shown.hotkeys, DEFAULT_HOTKEYS);

  return (
    <div className={s.wrap} ref={wrap}>
      <button
        type="button"
        className={s.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={dirty ? "Settings and account (unsaved changes)" : "Settings and account"}
        title={dirty ? "Settings: you have unsaved changes" : "Settings"}
        onClick={() => setOpen((o) => !o)}
      >
        <UserAvatar account={email} initials={initials} size={38} hasPhoto={!demo} />
        <span className={s.gear} aria-hidden="true">
          <GearGlyph />
        </span>
        {dirty && <span className={s.unsaved} aria-hidden="true" />}
      </button>

      {open && (
        <div className={s.panel} role="dialog" aria-label="Settings">
          <div className={s.profile}>
            <UserAvatar account={email} initials={initials} size={52} hasPhoto={!demo} />
            <div>
              <b>{name || email}</b>
              {name && <span>{email}</span>}
            </div>
          </div>

          <section>
            <h3>Connection</h3>
            <div className={s.conn}>
              <span className={`${s.dot} ${demo ? s.dotDemo : s.dotOn}`} aria-hidden="true" />
              <b>{demo ? "Demo mode" : "Gmail"}</b>
              <span className={s.status}>{demo ? "Sample emails" : "Connected"}</span>
            </div>
          </section>

          <section>
            <h3>Appearance</h3>
            <ThemeToggle labelled />
          </section>

          <section>
            <div className={s.sliderHead}>
              <h3 id="batch-label">Emails per batch</h3>
              <output className={s.value} htmlFor="batch-size">
                {shown.batchSize}
              </output>
            </div>
            <input
              id="batch-size"
              className={s.slider}
              type="range"
              min={BATCH_MIN}
              max={BATCH_MAX}
              step={BATCH_STEP}
              value={shown.batchSize}
              aria-labelledby="batch-label"
              onChange={(e) => setDraft({ ...shown, batchSize: Number(e.target.value) })}
              style={{ ["--fill" as string]: `${((shown.batchSize - BATCH_MIN) / (BATCH_MAX - BATCH_MIN)) * 100}%` }}
            />
            <div className={s.scale}>
              <span>{BATCH_MIN}</span>
              <span>{BATCH_MAX}</span>
            </div>
            {shown.batchSize !== BATCH_DEFAULT && (
              <button type="button" className={s.link} onClick={() => setDraft({ ...shown, batchSize: BATCH_DEFAULT })}>
                Restore default ({BATCH_DEFAULT})
              </button>
            )}
          </section>

          {canVibrate() && (
            <label className={s.toggle}>
              <span>Vibrate on swipe</span>
              <input type="checkbox" checked={shown.haptics} onChange={(e) => setDraft({ ...shown, haptics: e.target.checked })} />
              <i aria-hidden="true" />
            </label>
          )}

          <details className={s.keys}>
            <summary>
              <h3>Keyboard shortcuts</h3>
            </summary>
            <ul>
              {HOTKEY_ORDER.map((a) => (
                <li key={a}>
                  <span>{HOTKEY_LABELS[a]}</span>
                  <button
                    type="button"
                    className={`${s.keyBtn} ${listening === a ? s.keyListening : ""}`}
                    onClick={() => {
                      setKeyError(null);
                      setListening(listening === a ? null : a);
                    }}
                    aria-label={`Change shortcut for ${HOTKEY_LABELS[a]}. Current key: ${keyLabel(shown.hotkeys[a])}`}
                  >
                    {listening === a ? "Press a key…" : <kbd>{keyLabel(shown.hotkeys[a])}</kbd>}
                  </button>
                </li>
              ))}
            </ul>
            {keyError && (
              <p className={s.keyError} role="alert">
                {keyError}
              </p>
            )}
            {!shortcutsAreDefault && (
              <button type="button" className={s.link} onClick={() => setDraft({ ...shown, hotkeys: DEFAULT_HOTKEYS })}>
                Restore default shortcuts
              </button>
            )}
          </details>

          {(dirty || justSaved) && (
            <div className={`${s.saveBar} ${justSaved && !dirty ? s.saved : ""}`} role="status">
              {dirty ? (
                <>
                  <span>Unsaved changes</span>
                  <div className={s.saveBtns}>
                    <button type="button" className="btn" onClick={discard}>
                      Discard
                    </button>
                    <button type="button" className="btn btnPrimary" onClick={save}>
                      Save changes
                    </button>
                  </div>
                </>
              ) : (
                <span className={s.savedMsg}>
                  <CheckIcon /> Saved
                </span>
              )}
            </div>
          )}

          <div className={s.actions}>
            <p className={s.legalLinks}>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </p>
            {signOutAction ? (
              <LoaderForm action={signOutAction} message="Signing you out…">
                <button type="submit" className={s.row}>
                  <LogoutIcon /> Sign out
                </button>
              </LoaderForm>
            ) : (
              <Link href="/login" className={s.row}>
                <LogoutIcon /> Leave demo
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GearGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}
