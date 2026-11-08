"use client";

import {
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { Mail, TagKind } from "@/lib/mock";
import { shouldIgnoreShortcut } from "@/lib/keyboard";
import { normalizeKey, type HotkeyAction } from "@/lib/prefs";
import { SenderAvatar } from "./Avatars";
import { SparkIcon } from "./icons";
import s from "./SwipeDeck.module.css";

/** left = read, right = star, up = archive, down = snooze */
export type Decision = "read" | "star" | "archive" | "snooze";

export interface SwipeDeckHandle {
  decide: (d: Decision) => void;
}

interface Props {
  /** Emails still to review. The first one is the top card. */
  items: Mail[];
  /** Id of a card that should animate in (used after Undo). */
  enterId?: string | null;
  /** Keyboard shortcuts work while this is true (and no dialog or text field has the keyboard). */
  keyboard?: boolean;
  /** Which key does what (from Settings). */
  keymap: Record<HotkeyAction, string>;
  /** Vibrate briefly on swipe, where the device supports it. */
  haptics?: boolean;
  /** Limit which decisions are possible (used by the guided walkthrough). Anything else snaps back. Default: all four. */
  allowed?: Decision[];
  /** Called when the full-email reader opens or closes. */
  onPeekChange?: (open: boolean) => void;
  onDecide: (id: string, d: Decision) => void;
  /** Link that opens the email in Gmail (real mail only). */
  mailLink?: (m: Mail) => string;
  /** Shown when there is nothing left to review. */
  empty: ReactNode;
}

const FLY_MS = 300;
const THRESHOLD = 110;
const HOLD_MS = 420;

/** Unit vector each decision flies along. */
const VEC: Record<Decision, [number, number]> = {
  read: [-1, 0],
  star: [1, 0],
  archive: [0, -1],
  snooze: [0, 1],
};

const VERDICT: Record<Decision, string> = {
  read: "Read",
  star: "Starred",
  archive: "Archived",
  snooze: "Snoozed",
};

const TAG_CLASS: Record<TagKind, string> = {
  act: "tagAct",
  promo: "tagPromo",
  urgent: "tagUrgent",
  fyi: "tagFyi",
  plain: "",
};

/** Which decision the current drag points at, and how far along it is (0 to 1). */
function leaning(dx: number, dy: number): { d: Decision | null; strength: number } {
  if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return { d: null, strength: 0 };
  if (Math.abs(dy) > Math.abs(dx)) return { d: dy < 0 ? "archive" : "snooze", strength: Math.min(1, Math.abs(dy) / 90) };
  return { d: dx < 0 ? "read" : "star", strength: Math.min(1, Math.abs(dx) / 90) };
}

/** The rest of the email after the summary, so the card is filled with real content instead of empty space. */
function excerptOf(m: Mail): string {
  const sentences = m.body
    .join(" ")
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) => x && !m.summary.includes(x));
  return sentences.join(" ").slice(0, 900);
}

const SwipeDeck = forwardRef<SwipeDeckHandle, Props>(function SwipeDeck(
  { items, enterId, keyboard = false, keymap, haptics = false, allowed, onPeekChange, onDecide, mailLink, empty },
  ref,
) {
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [flying, setFlying] = useState<Decision | null>(null);
  const [peek, setPeekState] = useState(false);

  // dx/dy are mirrored here so a fast flick (move and release in the same frame) still sees the latest offset.
  const gesture = useRef({ x: 0, y: 0, dx: 0, dy: 0, moved: false, timer: 0 });
  const peekRef = useRef(false);

  const setPeek = useCallback((v: boolean) => {
    peekRef.current = v;
    setPeekState(v);
  }, []);

  const top = items[0];

  useEffect(() => {
    onPeekChange?.(peek);
  }, [peek, onPeekChange]);

  /** A short buzz, only on devices that can, and never when the person asked for reduced motion. */
  const buzz = useCallback(
    (ms: number) => {
      if (!haptics || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      // Browsers refuse to vibrate before the person has touched the page; skip quietly instead of logging an error.
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
      navigator.vibrate(ms);
    },
    [haptics],
  );

  const decide = useCallback(
    (d: Decision) => {
      if (flying || !top) return;
      if (allowed && !allowed.includes(d)) return;
      const id = top.id;
      buzz(12);
      setFlying(d);
      setPeek(false);
      window.setTimeout(() => {
        setFlying(null);
        setDragging(false);
        setDx(0);
        setDy(0);
        onDecide(id, d);
      }, FLY_MS + 20);
    },
    [flying, top, onDecide, setPeek, buzz, allowed],
  );

  useImperativeHandle(ref, () => ({ decide }), [decide]);

  // Keyboard: your shortcuts decide, the "read full email" key opens or closes the reader, Esc closes it.
  useEffect(() => {
    if (!keyboard) return;
    const DECISIONS: Decision[] = ["read", "star", "archive", "snooze"];
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!shouldIgnoreShortcut(e)) setPeek(false);
        return;
      }
      if (shouldIgnoreShortcut(e)) return;
      const key = normalizeKey(e.key);
      if (key === keymap.peek) {
        // A focused button uses Space itself, so leave it alone.
        if (key === " " && (document.activeElement as HTMLElement | null)?.tagName === "BUTTON") return;
        if (!top) return;
        e.preventDefault();
        if (!e.repeat) setPeek(!peekRef.current);
        return;
      }
      // While reading, the keys scroll the email instead of swiping the card.
      if (peekRef.current) return;
      const d = DECISIONS.find((x) => keymap[x] === key);
      if (d) {
        e.preventDefault();
        decide(d);
      }
    };
    window.addEventListener("keydown", down);
    // Only the listener is removed here. The reader must stay open if this effect re-runs for an unrelated reason.
    return () => window.removeEventListener("keydown", down);
  }, [keyboard, keymap, decide, top, setPeek]);

  function onPointerDown(e: ReactPointerEvent<HTMLElement>) {
    // While the reader is open, touches belong to the email (scrolling), not to the swipe.
    if (flying || peekRef.current) return;
    // Let the "Open in Gmail" link work like a normal link.
    if ((e.target as HTMLElement).closest("a")) return;
    const g = gesture.current;
    g.x = e.clientX;
    g.y = e.clientY;
    g.dx = 0;
    g.dy = 0;
    g.moved = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* not all environments support capture */
    }
    setDragging(true);
    window.clearTimeout(g.timer);
    g.timer = window.setTimeout(() => {
      if (!g.moved) {
        buzz(8);
        setPeek(true);
      }
    }, HOLD_MS);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLElement>) {
    if (!dragging || flying) return;
    const g = gesture.current;
    const mx = e.clientX - g.x;
    const my = e.clientY - g.y;
    if (!g.moved && Math.hypot(mx, my) > 8 && !peekRef.current) {
      g.moved = true;
      window.clearTimeout(g.timer);
    }
    if (g.moved) {
      g.dx = mx;
      g.dy = my;
      setDx(mx);
      setDy(my);
    }
  }

  function endGesture() {
    if (!dragging || flying) return;
    window.clearTimeout(gesture.current.timer);
    setDragging(false);
    // A long press opened the reader: leave it open so the email can be scrolled. Close it with the button or Esc.
    if (peekRef.current) return;
    const { dx: fx, dy: fy } = gesture.current;
    const lean = leaning(fx, fy);
    const distance = lean.d === "archive" || lean.d === "snooze" ? Math.abs(fy) : Math.abs(fx);
    if (lean.d && distance > THRESHOLD && (!allowed || allowed.includes(lean.d))) {
      decide(lean.d);
    } else {
      setDx(0);
      setDy(0);
    }
  }

  if (items.length === 0) return <div className={s.deck}>{empty}</div>;

  const visible = items.slice(0, 3);
  // Render back-to-front so the DOM order stays stable as cards leave the top.
  const ordered = visible.map((m, i) => ({ m, i })).reverse();
  const lean = leaning(dx, dy);
  const permitted = (d: Decision | null) => d !== null && (!allowed || allowed.includes(d));
  const active: Decision | null = permitted(flying ?? lean.d) ? (flying ?? lean.d) : null;
  // A direction that is not allowed right now feels stiff and does not light up.
  const stiff = lean.d !== null && !permitted(lean.d) ? 0.25 : 1;
  const strength = flying ? 1 : lean.strength;
  const progress = flying ? 1 : dragging ? Math.min(1, Math.max(Math.abs(dx), Math.abs(dy)) / 140) : 0;
  const vertical = Math.abs(dy) > Math.abs(dx);

  return (
    <div className={s.deck}>
      {ordered.map(({ m, i }) => {
        const isTop = i === 0;
        let style: CSSProperties;
        if (isTop) {
          if (flying) {
            const [vx, vy] = VEC[flying];
            style = {
              transform: `translate(${vx * 520}px, ${vy * 640 + (vx ? dy * 0.35 : 0)}px) rotate(${vx * 16}deg)`,
              opacity: 0,
              transition: `transform ${FLY_MS}ms var(--ease), opacity ${FLY_MS}ms`,
            };
          } else if (dragging && (dx !== 0 || dy !== 0)) {
            style = vertical
              ? { transform: `translate(${dx * 0.3 * stiff}px, ${dy * stiff}px)`, transition: "none" }
              : { transform: `translate(${dx * stiff}px, ${dy * 0.35 * stiff}px) rotate(${(dx * stiff) / 22}deg)`, transition: "none" };
          } else {
            style = { transform: "none", transition: "transform .5s var(--spring)" };
          }
        } else {
          const n = i - progress;
          style = {
            transform: `translateY(${-n * 15}px) scale(${1 - n * 0.055})`,
            opacity: (i === 1 ? 0.85 : 0.55) + progress * 0.3 * (i === 1 ? 0.5 : 1),
            transition: dragging ? "none" : "transform .4s var(--ease), opacity .4s",
          };
        }
        style.zIndex = 10 - i;

        const classes = [s.card, isTop ? s.top : "", isTop && dragging ? s.dragging : "", isTop && peek ? s.previewing : "", isTop && enterId === m.id ? s.enter : ""]
          .filter(Boolean)
          .join(" ");

        return (
          <article
            key={m.id}
            className={classes}
            style={style}
            aria-hidden={!isTop}
            {...(isTop
              ? {
                  onPointerDown,
                  onPointerMove,
                  onPointerUp: endGesture,
                  onPointerCancel: endGesture,
                  onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
                }
              : {})}
          >
            {isTop &&
              (Object.keys(VEC) as Decision[]).map((d) => (
                <Fragment key={d}>
                  <div className={`${s.edge} ${s[`edge_${d}`]}`} style={{ opacity: active === d ? strength : 0 }} />
                  <div className={`${s.verdict} ${s[`v_${d}`]}`} style={{ opacity: active === d ? strength : 0 }}>
                    {VERDICT[d]}
                  </div>
                </Fragment>
              ))}

            <div className={s.tags}>
              {m.tags.map((t) => (
                <span key={t.label} className={`tag ${TAG_CLASS[t.kind]}`}>
                  {t.kind !== "plain" && <i />}
                  {t.label}
                </span>
              ))}
            </div>

            <div className={s.sender}>
              <SenderAvatar name={m.name} address={m.address} initials={m.initials} color={m.color} size={50} />
              <div className={s.from}>
                <b>{m.name}</b>
                <span className={s.sent}>{m.sentAt ?? m.time}</span>
                {m.address && <span className={s.addr}>{m.address}</span>}
              </div>
            </div>

            <h3 className={s.subject}>{m.subject}</h3>
            <p className={s.summary}>
              <SparkIcon aria-hidden /> {m.summary}
            </p>
            {!!m.facts?.length && (
              <ul className={s.facts} aria-label="Key details">
                {m.facts.map((f) => (
                  <li key={f.label} className={f.tone === "urgent" ? s.factUrgent : undefined}>
                    {f.label}
                  </li>
                ))}
              </ul>
            )}
            {(() => {
              const more = excerptOf(m);
              return more ? <p className={s.excerpt}>{more}</p> : <span className={s.grow} />;
            })()}

            <div className={s.foot}>
              <span className={s.hint}>
                <i />
                Hold to read full email
                <i />
              </span>
              {isTop && mailLink && (
                <a className={s.open} href={mailLink(m)} target="_blank" rel="noopener noreferrer">
                  Open in Gmail ↗
                </a>
              )}
            </div>

            <div className={s.peek} aria-hidden={!(isTop && peek)} inert={!(isTop && peek)}>
              <div className={s.peekBar}>
                <div className={s.peekFrom}>
                  <b>{m.name}</b>
                  <span>{m.time}</span>
                </div>
                <button type="button" className={s.close} onClick={() => setPeek(false)} aria-label="Close full email">
                  Close
                </button>
              </div>
              <div className={s.peekBody}>
                <h4>{m.subject}</h4>
                {m.html ? (
                  // Sanitised on the server (allow-listed tags, no remote images, no scripts). See sanitizeEmailHtml.
                  <div className={s.rich} dangerouslySetInnerHTML={{ __html: m.html }} />
                ) : (
                  m.body.map((p, k) => <p key={k}>{p}</p>)
                )}
                {!!m.hiddenImages && (
                  <small className={s.imgNote}>
                    {m.hiddenImages} {m.hiddenImages === 1 ? "image" : "images"} hidden to protect your privacy
                  </small>
                )}
                {isTop && mailLink && (
                  <a className={s.openBottom} href={mailLink(m)} target="_blank" rel="noopener noreferrer">
                    Open in Gmail ↗
                  </a>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
});

export default SwipeDeck;
