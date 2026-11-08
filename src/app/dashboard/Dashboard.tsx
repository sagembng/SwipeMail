"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Brand from "@/components/Brand";
import SwipeDeck, { type Decision, type SwipeDeckHandle } from "@/components/SwipeDeck";
import EmailReader from "@/components/EmailReader";
import HelpDialog from "@/components/HelpDialog";
import LoaderForm from "@/components/LoaderForm";
import SettingsMenu from "@/components/SettingsMenu";
import { SenderAvatar } from "@/components/Avatars";
import { getOnboarded, getOnboardedOnServer, markOnboarded, subscribe as subscribeOnboarding } from "@/components/onboarding";
import { ArchiveIcon, CheckIcon, ClockIcon, ExternalIcon, HelpIcon, RefreshIcon, StarIcon, UndoIcon } from "@/components/icons";
import type { ApiError, ApiMail, MailAction } from "@/lib/mail-types";
import { shouldIgnoreShortcut } from "@/lib/keyboard";
import { keyLabel, normalizeKey } from "@/lib/prefs";
import { usePrefsAccount } from "@/lib/prefs-scope";
import { readPrefs, usePrefs } from "@/lib/prefs-store";
import { MAILS, type Mail } from "@/lib/mock";
import s from "./dashboard.module.css";

type Tab = "today" | "earlier" | "starred";
const TABS: { id: Tab; label: string }[] = [
  { id: "earlier", label: "Earlier" },
  { id: "today", label: "Today" },
  { id: "starred", label: "Starred" },
];

interface Account {
  name: string;
  email: string;
  initials: string;
  image: string | null;
}

interface Props {
  account: Account;
  /** Public demo: sample emails, nothing is sent to Gmail. */
  demo?: boolean;
  /** Server action that signs the user out. Not used in demo mode. */
  signOutAction?: () => Promise<void>;
}

/** "8:12 AM" today, "Yesterday", a weekday within the last week, otherwise "Nov 3". */
function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days <= 0) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** "Today, 8:12 AM", "Yesterday, 4:55 PM", "Mon, 9:30 AM" or "Nov 3, 6:18 PM". Shown on the card and in the reader. */
function formatSent(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  const clock = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (days <= 0) return `Today, ${clock}`;
  if (days === 1) return `Yesterday, ${clock}`;
  if (days < 7) return `${d.toLocaleDateString([], { weekday: "short" })}, ${clock}`;
  const date = d.toLocaleDateString([], d.getFullYear() === now.getFullYear() ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
  return `${date}, ${clock}`;
}

function toMail(m: ApiMail): Mail {
  const sameDay = new Date(m.receivedAt).toDateString() === new Date().toDateString();
  return {
    id: m.id,
    threadId: m.threadId,
    name: m.name,
    address: m.address,
    initials: m.initials,
    color: m.color,
    time: formatTime(m.receivedAt),
    sentAt: formatSent(m.receivedAt),
    subject: m.subject,
    summary: m.summary,
    tags: m.tags,
    facts: m.facts,
    body: m.body,
    html: m.html,
    hiddenImages: m.hiddenImages,
    light: m.light,
    bucket: sameDay ? "today" : "earlier",
  };
}

/* Snooze has no Gmail equivalent, so it lives in this browser: { messageId: wake-up time in ms }. */
const snoozeKey = (email: string) => `swipemail:snooze:${email}`;
function readSnoozed(email: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(snoozeKey(email)) || "{}");
  } catch {
    return {};
  }
}
function writeSnoozed(email: string, map: Record<string, number>) {
  try {
    localStorage.setItem(snoozeKey(email), JSON.stringify(map));
  } catch {
    /* storage unavailable: snooze lasts only until the next reload */
  }
}
/** Before 2 PM: back at 3 PM today. Otherwise: back at 8 AM tomorrow. */
function snoozeTarget(now: Date) {
  const at = new Date(now);
  if (now.getHours() < 14) {
    at.setHours(15, 0, 0, 0);
    return { at, label: "3 PM today" };
  }
  at.setDate(at.getDate() + 1);
  at.setHours(8, 0, 0, 0);
  return { at, label: "8 AM tomorrow" };
}

async function sendAction(id: string, action: MailAction): Promise<string | null> {
  try {
    const res = await fetch(`/api/mail/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) return null;
    const json = await res.json().catch(() => null);
    return json?.error?.message ?? "Gmail did not accept the change.";
  } catch {
    return "Network problem. Gmail was not updated.";
  }
}

/**
 * Opens a conversation in Gmail on the right account. `authuser` takes the email address, and "#all" finds the
 * conversation even after it has been archived (an "#inbox" address would not).
 */
function gmailLink(email: string, threadId: string) {
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}#all/${encodeURIComponent(threadId)}`;
}

type Fetched = { ok: true; json: Record<string, unknown> } | { ok: false; message: string; code?: ApiError["code"] };

const inFlight = new Map<string, Promise<Fetched>>();

/** GET a JSON endpoint. Identical requests made at the same moment share one network call. */
function getJson(url: string): Promise<Fetched> {
  const running = inFlight.get(url);
  if (running) return running;
  const request = (async (): Promise<Fetched> => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, message: json?.error?.message ?? "Could not load your emails.", code: json?.error?.code };
      return { ok: true, json: json ?? {} };
    } catch {
      return { ok: false, message: "Could not reach SwipeMail. Check your connection." };
    }
  })().finally(() => inFlight.delete(url));
  inFlight.set(url, request);
  return request;
}

/** Background check for new mail. Only asks Gmail for the newest message ids, and only while this tab is visible. */
const CHECK_EVERY_MS = 5 * 60_000;

export default function Dashboard({ account, demo = false, signOutAction }: Props) {
  const [tab, setTab] = useState<Tab>("today");
  const [decided, setDecided] = useState<Record<string, Decision>>({});
  const [history, setHistory] = useState<string[]>([]);
  const [enterId, setEnterId] = useState<string | null>(null);
  const deck = useRef<SwipeDeckHandle>(null);
  const prefs = usePrefs();
  const prefsAccount = usePrefsAccount();

  // Welcome tour: opens by itself on the first visit in this browser, and any time from the ? button.
  const onboarded = useSyncExternalStore(subscribeOnboarding, getOnboarded, getOnboardedOnServer);
  const [helpOpen, setHelpOpen] = useState(false);
  const showHelp = helpOpen || !onboarded;
  const closeHelp = useCallback(() => {
    setHelpOpen(false);
    markOnboarded();
  }, []);

  // Real mail (non-demo)
  const [phase, setPhase] = useState<"loading" | "ready" | "error">(demo ? "ready" : "loading");
  const [fetched, setFetched] = useState<Mail[]>([]);
  const [fetchedStarred, setFetchedStarred] = useState<Mail[]>([]);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyRetry, setBusyRetry] = useState(false); // Gmail asked us to slow down; retrying on our own
  const [snoozedHidden, setSnoozedHidden] = useState(0); // snoozed in an earlier visit, still asleep
  const [nextToken, setNextToken] = useState<string | null>(null); // Gmail page token for more unread mail
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [starredLoaded, setStarredLoaded] = useState(false); // the Starred list is fetched only when that tab is opened
  const [starredLoading, setStarredLoading] = useState(false);
  const [reading, setReading] = useState<Mail | null>(null); // starred email open in the reader
  const [readerLoading, setReaderLoading] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState<number | null>(null);
  const lastCheck = useRef(0);
  const checking = useRef(false);
  const latest = useRef({ fetched: [] as Mail[], decided: {} as Record<string, Decision>, starredLoaded: false });
  const [notice, setNoticeState] = useState<{ text: string; tone: "error" | "info" } | null>(null);
  const noticeTimer = useRef(0);

  const showNotice = useCallback((text: string, tone: "error" | "info" = "error") => {
    window.clearTimeout(noticeTimer.current);
    setNoticeState({ text, tone });
    if (tone === "info") noticeTimer.current = window.setTimeout(() => setNoticeState(null), 4500);
  }, []);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    (async () => {
      const url = `/api/mail?size=${readPrefs(prefsAccount).batchSize}`;
      let r = await getJson(url);
      // If Gmail says it is busy, wait a little and try again by itself instead of showing an error.
      for (let attempt = 0; !r.ok && r.code === "rate_limited" && attempt < 2 && !cancelled; attempt++) {
        setBusyRetry(true);
        await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)));
        if (cancelled) return;
        r = await getJson(url);
      }
      if (cancelled) return;
      setBusyRetry(false);
      if (!r.ok) {
        setLoadError({ code: r.code ?? "gmail_error", message: r.message });
        setPhase("error");
        return;
      }
      const json = r.json as { mails: ApiMail[]; nextPageToken?: string; unreadTotal?: number };
      const all: Mail[] = json.mails.map(toMail);
      // Hide emails that are still snoozed; forget wake-up times that have passed.
      const now = Date.now();
      const stored = readSnoozed(account.email);
      const live = Object.fromEntries(Object.entries(stored).filter(([, at]) => at > now));
      if (Object.keys(live).length !== Object.keys(stored).length) writeSnoozed(account.email, live);
      const mails = all.filter((m) => !(m.id in live));
      setSnoozedHidden(all.length - mails.length);
      setFetched(mails);
      setFetchedStarred([]);
      setStarredLoaded(false);
      setNextToken(json.nextPageToken ?? null);
      setUnreadTotal(typeof json.unreadTotal === "number" ? json.unreadTotal : null);
      lastCheck.current = Date.now();
      // Land on the tab that has something in it.
      setTab(mails.some((m) => m.bucket === "today") || !mails.length ? "today" : "earlier");
      setPhase("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, reloadKey, account.email, prefsAccount]);

  function reload() {
    setPhase("loading");
    setLoadError(null);
    setDecided({});
    setHistory([]);
    setReloadKey((k) => k + 1);
  }

  const all = demo ? MAILS : fetched;

  useEffect(() => {
    latest.current = { fetched, decided, starredLoaded };
  });

  /** Wake-up times that are still in the future. */
  const liveSnoozed = useCallback((): Record<string, number> => {
    const now = Date.now();
    return Object.fromEntries(Object.entries(readSnoozed(account.email)).filter(([, at]) => at > now));
  }, [account.email]);

  /** Fetches the next page of unread mail and adds it to the end of the stack. */
  const loadMore = useCallback(async () => {
    if (demo || !nextToken || loadingMore) return;
    setLoadingMore(true);
    const r = await getJson(`/api/mail?size=${readPrefs(prefsAccount).batchSize}&pageToken=${encodeURIComponent(nextToken)}`);
    setLoadingMore(false);
    if (!r.ok) {
      showNotice(r.message);
      return;
    }
    const live = liveSnoozed();
    const incoming = (r.json.mails as ApiMail[]).map(toMail).filter((m) => !(m.id in live));
    setFetched((prev) => [...prev, ...incoming.filter((m) => !prev.some((p) => p.id === m.id))]);
    setNextToken((r.json.nextPageToken as string | undefined) ?? null);
  }, [demo, nextToken, loadingMore, liveSnoozed, showNotice, prefsAccount]);

  /**
   * Looks for new mail without re-downloading everything: first only the newest ids, then full messages for the unknown ones.
   * Manual: new mail goes on top and the Starred list is refreshed. Silent (automatic): new mail goes to the end so the
   * card you are reading does not change under you.
   */
  const refresh = useCallback(
    async (silent: boolean) => {
      if (demo || checking.current) return;
      checking.current = true;
      if (!silent) setRefreshing(true);
      try {
        const idsRes = await getJson(`/api/mail?view=ids&size=${readPrefs(prefsAccount).batchSize}`);
        if (!idsRes.ok) {
          if (!silent) showNotice(idsRes.message);
          return;
        }
        if (typeof idsRes.json.unreadTotal === "number") setUnreadTotal(idsRes.json.unreadTotal);

        const { fetched: have, decided: done } = latest.current;
        const live = liveSnoozed();
        const known = new Set([...have.map((m) => m.id), ...Object.keys(done)]);
        const unknown = (idsRes.json.ids as string[]).filter((id) => !known.has(id) && !(id in live));

        let added = 0;
        if (unknown.length) {
          const full = await getJson(`/api/mail?ids=${unknown.join(",")}`);
          if (!full.ok) {
            if (!silent) showNotice(full.message);
            return;
          }
          const incoming = (full.json.mails as ApiMail[]).map(toMail);
          added = incoming.length;
          setFetched((prev) => {
            const fresh = incoming.filter((m) => !prev.some((p) => p.id === m.id));
            return silent ? [...prev, ...fresh] : [...fresh, ...prev];
          });
        }
        if (!silent && latest.current.starredLoaded) {
          const st = await getJson("/api/mail?view=starred");
          if (st.ok) setFetchedStarred((st.json.mails as ApiMail[]).map(toMail));
        }
        lastCheck.current = Date.now();
        if (added) showNotice(`${added} new ${added === 1 ? "email" : "emails"} ${silent ? "added to your stack" : "on top"}.`, "info");
        else if (!silent) showNotice("You are up to date.", "info");
      } finally {
        checking.current = false;
        setRefreshing(false);
      }
    },
    [demo, liveSnoozed, showNotice, prefsAccount],
  );

  // Automatic checks: every minute while the tab is visible, and when you come back to the tab after a while.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });
  useEffect(() => {
    if (demo || phase !== "ready") return;
    const run = () => {
      if (document.visibilityState === "visible") void refreshRef.current(true);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastCheck.current > 30_000) void refreshRef.current(true);
    };
    const timer = window.setInterval(run, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [demo, phase]);

  // Gmail's count was taken at the last check; subtract what has been cleared since.
  const cleared = Object.values(decided).filter((d) => d === "read" || d === "archive").length;
  const unreadLeft = Math.max(0, (unreadTotal ?? 0) - cleared);
  const inTab = tab === "starred" ? [] : all.filter((m) => m.bucket === tab);
  const queue = inTab.filter((m) => !decided[m.id]);
  const sessionStarred = all.filter((m) => decided[m.id] === "star");
  const starred = [...sessionStarred, ...fetchedStarred.filter((m) => !sessionStarred.some((x) => x.id === m.id))];
  const doneCount = inTab.length - queue.length;

  const onDecide = useCallback(
    (id: string, d: Decision) => {
      setDecided((prev) => ({ ...prev, [id]: d }));
      setHistory((h) => [...h, id]);
      setEnterId(null);

      if (d === "snooze") {
        const { at, label } = snoozeTarget(new Date());
        if (!demo) writeSnoozed(account.email, { ...readSnoozed(account.email), [id]: at.getTime() });
        showNotice(`Snoozed until ${label}. Press Z to undo.`, "info");
        return;
      }
      if (d === "archive") showNotice("Archived and marked read. Press Z to undo.", "info");
      if (demo) return;

      // Optimistic: the card is already gone. If Gmail refuses, bring it back and say why.
      sendAction(id, d === "read" ? "read" : d === "star" ? "star" : "archive").then((err) => {
        if (!err) return;
        setDecided((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setHistory((h) => h.filter((x) => x !== id));
        setEnterId(id);
        showNotice(err);
      });
    },
    [demo, account.email, showNotice],
  );

  const undo = useCallback(() => {
    const id = history[history.length - 1];
    if (!id) return;
    const was = decided[id];
    setHistory(history.slice(0, -1));
    setDecided((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    const mail = all.find((m) => m.id === id);
    if (mail) setTab(mail.bucket);
    setEnterId(id);
    if (demo || !was) return;
    if (was === "snooze") {
      const map = readSnoozed(account.email);
      delete map[id];
      writeSnoozed(account.email, map);
      return;
    }
    const reverse = { read: "unread", star: "unstar", archive: "unarchive" } as const;
    sendAction(id, reverse[was]).then((err) => {
      if (err) showNotice(`Undo could not be saved to Gmail. ${err}`);
    });
  }, [history, decided, all, demo, account.email, showNotice]);

  // Shortcuts work as soon as the emails are on screen, with no need to move the mouse over them first.
  const shortcutsOn = phase === "ready";
  useEffect(() => {
    if (!shortcutsOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (shouldIgnoreShortcut(e)) return;
      if (normalizeKey(e.key) === prefs.hotkeys.undo) undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcutsOn, undo, prefs.hotkeys.undo]);

  /** Opens a starred email. The list only has a snippet, so the full text is fetched when it is opened. */
  async function openStarred(m: Mail) {
    const full = all.find((x) => x.id === m.id && !x.light);
    setReading(full ?? m);
    if (demo || full || !m.light) return;
    setReaderLoading(true);
    const r = await getJson(`/api/mail?ids=${m.id}`);
    setReaderLoading(false);
    if (!r.ok) {
      showNotice(r.message);
      return;
    }
    const loaded = (r.json.mails as ApiMail[]).map(toMail)[0];
    if (loaded) setReading((cur) => (cur?.id === m.id ? loaded : cur));
  }

  /** Removes a starred email from the Starred list on screen. Returns a function that puts it back. */
  function takeOutOfStarred(m: Mail) {
    const wasSession = decided[m.id] === "star";
    if (wasSession) {
      setDecided((prev) => {
        const next = { ...prev };
        delete next[m.id];
        return next;
      });
      setHistory((h) => h.filter((x) => x !== m.id));
    } else {
      setFetchedStarred((prev) => prev.filter((x) => x.id !== m.id));
    }
    return () => {
      if (wasSession) setDecided((prev) => ({ ...prev, [m.id]: "star" }));
      else setFetchedStarred((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]));
    };
  }

  /** Unstar: the email stays unread and goes back into the stack to be reviewed again. */
  async function unstar(m: Mail) {
    setReading(null);
    const cameFromGmailList = decided[m.id] !== "star";
    const restore = takeOutOfStarred(m);
    if (!demo) {
      const err = await sendAction(m.id, "unstar");
      if (err) {
        restore();
        showNotice(err);
        return;
      }
      if (cameFromGmailList) {
        // It was only in Gmail's starred list, so bring its full text back into the stack.
        let full = m;
        const r = await getJson(`/api/mail?ids=${m.id}`);
        if (r.ok) full = (r.json.mails as ApiMail[]).map(toMail)[0] ?? m;
        setFetched((prev) => (prev.some((p) => p.id === m.id) ? prev : [full, ...prev]));
      }
    }
    showNotice("Unstarred. It is back in your stack.", "info");
  }

  /** Done with a starred email: mark it read and remove the star. */
  async function finishStarred(m: Mail) {
    setReading(null);
    const wasSession = decided[m.id] === "star";
    const restore = takeOutOfStarred(m);
    if (wasSession) setDecided((prev) => ({ ...prev, [m.id]: "read" }));
    if (!demo) {
      const err = await sendAction(m.id, "done");
      if (err) {
        if (wasSession) setDecided((prev) => ({ ...prev, [m.id]: "star" }));
        else restore();
        showNotice(err);
        return;
      }
    }
    showNotice("Marked read and unstarred.", "info");
  }

  /** Loads the Starred list the first time that tab is opened (a light download: headers and a snippet). */
  async function loadStarred() {
    setStarredLoading(true);
    const r = await getJson("/api/mail?view=starred");
    setStarredLoading(false);
    if (r.ok) {
      setFetchedStarred((r.json.mails as ApiMail[]).map(toMail));
      setStarredLoaded(true);
    } else {
      showNotice(r.message);
    }
  }

  function selectTab(t: Tab) {
    setTab(t);
    if (t === "starred" && !demo && !starredLoaded && !starredLoading) void loadStarred();
  }

  function startOver() {
    setDecided((prev) => {
      const next = { ...prev };
      for (const m of inTab) delete next[m.id];
      return next;
    });
    setHistory((h) => h.filter((id) => !inTab.some((m) => m.id === id)));
  }

  const showCount = phase !== "ready" ? "–" : tab === "starred" ? starred.length : queue.length;
  const snoozedTotal = snoozedHidden + all.filter((m) => decided[m.id] === "snooze").length;
  const mailLink = demo
    ? undefined
    : (m: Mail) => gmailLink(account.email, m.threadId ?? m.id);
  const swipeReady = phase === "ready";

  return (
    <div className={s.page}>
      <header className={`${s.topbar} glass`}>
        <Brand href={demo ? "/demo" : "/dashboard"} />

        <div className={`${s.tabs} glass`} role="tablist" aria-label="Mail group">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => selectTab(t.id)}>
              {t.label}
              {t.id === "starred" && starred.length > 0 && <em>{starred.length}</em>}
            </button>
          ))}
        </div>

        <div className={s.right}>
          <button type="button" className={`${s.iconBtn} glass`} onClick={() => setHelpOpen(true)} aria-label="Help: how SwipeMail works" title="Help">
            <HelpIcon />
          </button>
          <SettingsMenu
            name={account.name}
            email={account.email}
            initials={account.initials}
            demo={demo}
            signOutAction={signOutAction}
          />
        </div>
      </header>

      {showHelp && <HelpDialog onClose={closeHelp} />}

      {reading && (
        <EmailReader
          mail={reading}
          loading={readerLoading}
          gmailHref={mailLink?.(reading)}
          onClose={() => setReading(null)}
          onUnstar={() => void unstar(reading)}
          onDone={() => void finishStarred(reading)}
        />
      )}

      {notice && (
        <div className={`${s.notice} glass`} data-tone={notice.tone} role={notice.tone === "error" ? "alert" : "status"}>
          <span>{notice.text}</span>
          <button onClick={() => setNoticeState(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <main
        className={s.main}
      >
        <div className={s.big} aria-live="polite">
          <b>{showCount}</b>
          <span>
            {tab === "starred" ? (
              <>
                starred
                <br />
                emails
              </>
            ) : (
              <>
                to
                <br />
                review
              </>
            )}
          </span>
        </div>
        {tab !== "starred" && (
          <div className={s.prog} aria-hidden="true">
            <i style={{ width: `${inTab.length ? (doneCount / inTab.length) * 100 : 0}%` }} />
          </div>
        )}
        {swipeReady && (
          <div className={s.metaRow}>
            {!demo && (
              <button className={s.refresh} onClick={() => void refresh(false)} disabled={refreshing} aria-label="Check for new mail">
                <RefreshIcon className={refreshing ? s.spin : undefined} />
                {refreshing ? "Checking…" : "Refresh"}
              </button>
            )}
            {!demo && unreadTotal !== null && <span>{unreadLeft.toLocaleString()} unread in Gmail</span>}
            {tab !== "starred" && snoozedTotal > 0 && (
              <span className={s.snoozeNote}>
                <ClockIcon /> {snoozedTotal} snoozed
              </span>
            )}
          </div>
        )}

        {phase === "loading" && (
          <div className={`${s.status} glass`} role="status">
            <Image src="/logo.png" alt="" width={900} height={371} className={s.statusLogo} />
            <h2>Gathering your unread emails</h2>
            <p>{busyRetry ? "Gmail is busy. Trying again in a moment." : "Reading your Gmail inbox. This takes a few seconds."}</p>
          </div>
        )}

        {phase === "error" && loadError && (
          <div className={`${s.status} glass`} role="alert">
            <h2>Could not load your emails</h2>
            <p>{loadError.message}</p>
            <div className={s.statusActions}>
              {loadError.code !== "reauth" && loadError.code !== "unauthenticated" && loadError.code !== "scope" && (
                <button className="btn btnPrimary" onClick={reload}>
                  Try again
                </button>
              )}
              {signOutAction && (
                <LoaderForm action={signOutAction} message="Signing you out…">
                  <button type="submit" className="btn">
                    Sign out and sign in again
                  </button>
                </LoaderForm>
              )}
            </div>
          </div>
        )}

        {swipeReady && tab === "starred" &&
          (starredLoading ? (
            <div className={`${s.status} glass`} role="status">
              <span className={s.spinner} aria-hidden="true" />
              <h2>Loading starred emails</h2>
            </div>
          ) : (
            <StarredList items={starred} mailLink={mailLink} onOpen={openStarred} onUnstar={unstar} onDone={finishStarred} />
          ))}

        {swipeReady && tab !== "starred" && (
          <>
            <div className={s.stage}>
              <button className={`${s.side} ${s.sideRead} glass`} onClick={() => deck.current?.decide("read")} disabled={!queue.length}>
                <span className={s.ic}>
                  <CheckIcon />
                </span>
                Mark read
                <small>Swipe left or press {keyLabel(prefs.hotkeys.read)}</small>
              </button>

              <SwipeDeck
                ref={deck}
                items={queue}
                enterId={enterId}
                keyboard={shortcutsOn}
                keymap={prefs.hotkeys}
                haptics={prefs.haptics}
                onDecide={onDecide}
                mailLink={mailLink}
                empty={
                  loadingMore ? (
                    <div className={`${s.done} glass`} role="status">
                      <span className={s.spinner} aria-hidden="true" />
                      <h2>Loading more emails</h2>
                      <p>Fetching the next batch from Gmail.</p>
                    </div>
                  ) : (
                    <div className={`${s.done} glass`}>
                      <Image src="/logo.png" alt="" width={900} height={371} />
                      <h2>{inTab.length ? "Inbox clear" : "Nothing here"}</h2>
                      <p>
                        {inTab.length
                          ? `You went through ${inTab.length} ${inTab.length === 1 ? "email" : "emails"}.`
                          : demo
                            ? "No sample emails in this group."
                            : "No unread emails in this group."}
                      </p>
                      {demo ? (
                        inTab.length > 0 && (
                          <button className="btn btnPrimary" onClick={startOver}>
                            Start over
                          </button>
                        )
                      ) : (
                        <div className={s.statusActions}>
                          {nextToken && (
                            <button
                              className="btn btnPrimary"
                              onClick={() => void loadMore()}
                            >
                              Load next {prefs.batchSize} emails
                            </button>
                          )}
                          <button className={nextToken ? "btn" : "btn btnPrimary"} onClick={() => void refresh(false)}>
                            Check for new mail
                          </button>
                        </div>
                      )}
                    </div>
                  )
                }
              />

              <button className={`${s.side} ${s.sideStar} glass`} onClick={() => deck.current?.decide("star")} disabled={!queue.length}>
                <span className={s.ic}>
                  <StarIcon />
                </span>
                Star
                <small>Swipe right or press {keyLabel(prefs.hotkeys.star)}</small>
              </button>
            </div>

            <div className={s.under}>
              <div className={s.actions}>
                <button className={`${s.rb} ${s.rbRead}`} aria-label="Mark read" onClick={() => deck.current?.decide("read")} disabled={!queue.length}>
                  <CheckIcon />
                </button>
                <button className={`${s.rb} ${s.rbStar}`} aria-label="Star and keep unread" onClick={() => deck.current?.decide("star")} disabled={!queue.length}>
                  <StarIcon />
                </button>
              </div>
              <div className={s.extras}>
                <button className={`${s.pill} btn`} onClick={() => deck.current?.decide("archive")} disabled={!queue.length}>
                  <ArchiveIcon /> Archive <kbd>{keyLabel(prefs.hotkeys.archive)}</kbd>
                </button>
                <button className={`${s.pill} btn`} onClick={undo} disabled={!history.length}>
                  <UndoIcon /> Undo <kbd>{keyLabel(prefs.hotkeys.undo)}</kbd>
                </button>
                <button className={`${s.pill} btn`} onClick={() => deck.current?.decide("snooze")} disabled={!queue.length}>
                  <ClockIcon /> Snooze <kbd>{keyLabel(prefs.hotkeys.snooze)}</kbd>
                </button>
              </div>
              <div className={s.keys}>
                <span>
                  <kbd>{keyLabel(prefs.hotkeys.read)}</kbd> Read
                </span>
                <span>
                  <kbd>{keyLabel(prefs.hotkeys.star)}</kbd> Star
                </span>
                <span>
                  <kbd>{keyLabel(prefs.hotkeys.peek)}</kbd> Read full email
                </span>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StarredList({
  items,
  mailLink,
  onOpen,
  onUnstar,
  onDone,
}: {
  items: Mail[];
  mailLink?: (m: Mail) => string;
  onOpen: (m: Mail) => void;
  onUnstar: (m: Mail) => void;
  onDone: (m: Mail) => void;
}) {
  if (!items.length) {
    return (
      <div className={`${s.empty} glass`}>
        <StarIcon />
        <h2>Nothing starred yet</h2>
        <p>Swipe right on an email to star it. It stays unread in Gmail so you can come back to it.</p>
      </div>
    );
  }
  return (
    <ul className={s.list} aria-label="Starred emails">
      {items.map((m) => (
        <li key={m.id} className={`${s.row} glass`}>
          <button className={s.rowMain} onClick={() => onOpen(m)} aria-label={`Read email from ${m.name}: ${m.subject}`}>
            <SenderAvatar name={m.name} address={m.address} initials={m.initials} color={m.color} size={42} />
            <span className={s.rowText}>
              <b>{m.subject}</b>
              <span className={s.rowMeta}>
                {m.name} · {m.time}
              </span>
              <span className={s.rowSum}>{m.summary}</span>
            </span>
          </button>
          <div className={s.rowActions}>
            <button className={`${s.rowBtn} ${s.rowUnstar}`} onClick={() => onUnstar(m)} title="Unstar: put it back in your stack" aria-label={`Unstar ${m.subject}`}>
              <StarIcon />
            </button>
            <button className={`${s.rowBtn} ${s.rowDone}`} onClick={() => onDone(m)} title="Mark read and unstar" aria-label={`Mark ${m.subject} read`}>
              <CheckIcon />
            </button>
            {mailLink && (
              <a className={s.rowBtn} href={mailLink(m)} target="_blank" rel="noopener noreferrer" title="Open in Gmail" aria-label={`Open ${m.subject} in Gmail`}>
                <ExternalIcon />
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
