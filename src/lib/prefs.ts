/** User preferences: keyboard shortcuts and emails per batch. Pure functions (see prefs.test.ts). */

export type HotkeyAction = "read" | "star" | "archive" | "snooze" | "undo" | "peek";

export const HOTKEY_ORDER: HotkeyAction[] = ["read", "star", "archive", "snooze", "undo", "peek"];

export const HOTKEY_LABELS: Record<HotkeyAction, string> = {
  read: "Mark read",
  star: "Star",
  archive: "Archive",
  snooze: "Snooze",
  undo: "Undo",
  peek: "Read full email",
};

/** Values are `KeyboardEvent.key`, lower-cased for single characters. */
export const DEFAULT_HOTKEYS: Record<HotkeyAction, string> = {
  read: "ArrowLeft",
  star: "ArrowRight",
  archive: "ArrowUp",
  snooze: "ArrowDown",
  undo: "z",
  peek: " ",
};

export const BATCH_MIN = 5;
export const BATCH_MAX = 50;
export const BATCH_STEP = 5;
export const BATCH_DEFAULT = 25;

export interface Prefs {
  hotkeys: Record<HotkeyAction, string>;
  batchSize: number;
  /** Short vibration when a card is swiped, on phones that support it. */
  haptics: boolean;
}

export const DEFAULT_PREFS: Prefs = { hotkeys: DEFAULT_HOTKEYS, batchSize: BATCH_DEFAULT, haptics: true };

/** Keys that can never be assigned: they are needed to operate the page. */
const RESERVED = new Set(["Escape", "Tab", "Enter", "Shift", "Control", "Alt", "Meta", "CapsLock", "Backspace", "Delete", "Dead", "Unidentified"]);

export const normalizeKey = (key: string) => (key.length === 1 ? key.toLowerCase() : key);

export const isAssignable = (key: string) => !!key && !RESERVED.has(key) && !/^F\d{1,2}$/.test(key);

const KEY_NAMES: Record<string, string> = { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", " ": "Space" };

/** How a key is shown on screen. */
export function keyLabel(key: string): string {
  if (KEY_NAMES[key]) return KEY_NAMES[key];
  return key.length === 1 ? key.toUpperCase() : key;
}

export function clampBatch(n: number): number {
  if (!Number.isFinite(n)) return BATCH_DEFAULT;
  const stepped = Math.round(n / BATCH_STEP) * BATCH_STEP;
  return Math.min(BATCH_MAX, Math.max(BATCH_MIN, stepped));
}

/** Which action already uses this key (other than `except`), if any. */
export function actionUsing(hotkeys: Record<HotkeyAction, string>, key: string, except?: HotkeyAction): HotkeyAction | null {
  return HOTKEY_ORDER.find((a) => a !== except && hotkeys[a] === key) ?? null;
}

export type AssignResult = { ok: true; hotkeys: Record<HotkeyAction, string> } | { ok: false; reason: string };

/** Gives `action` the pressed key, unless it cannot be used or another action already has it. */
export function assignHotkey(hotkeys: Record<HotkeyAction, string>, action: HotkeyAction, pressed: string): AssignResult {
  const key = normalizeKey(pressed);
  if (!isAssignable(key)) return { ok: false, reason: `${keyLabel(key) || "That key"} cannot be used.` };
  const clash = actionUsing(hotkeys, key, action);
  if (clash) return { ok: false, reason: `${keyLabel(key)} is already used for "${HOTKEY_LABELS[clash]}".` };
  return { ok: true, hotkeys: { ...hotkeys, [action]: key } };
}

/** Reads saved preferences. Anything missing, invalid or duplicated falls back to the default. */
export function parsePrefs(raw: string | null): Prefs {
  if (!raw) return DEFAULT_PREFS;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_PREFS;
  }
  const obj = (data && typeof data === "object" ? data : {}) as { hotkeys?: Record<string, unknown>; batchSize?: unknown; haptics?: unknown };
  const haptics = typeof obj.haptics === "boolean" ? obj.haptics : true;
  const batchSize = typeof obj.batchSize === "number" ? clampBatch(obj.batchSize) : BATCH_DEFAULT;

  const hotkeys = { ...DEFAULT_HOTKEYS };
  const used = new Set<string>();
  for (const a of HOTKEY_ORDER) {
    const v = obj.hotkeys?.[a];
    const key = typeof v === "string" ? normalizeKey(v) : "";
    if (key && isAssignable(key) && !used.has(key)) {
      hotkeys[a] = key;
      used.add(key);
    }
  }
  // If a default was displaced by a custom key, make sure no two actions end up sharing a key.
  const seen = new Set<string>();
  for (const a of HOTKEY_ORDER) {
    if (seen.has(hotkeys[a])) return { hotkeys: DEFAULT_HOTKEYS, batchSize, haptics };
    seen.add(hotkeys[a]);
  }

  return { hotkeys, batchSize, haptics };
}

/** The single, shared key used before preferences were kept per account. Only read once, to hand it to the first account. */
export const LEGACY_PREFS_KEY = "swipemail:prefs";

/** Where one account's preferences are saved in the browser. Case does not matter in an email address. */
export const prefsStorageKey = (account: string) => `swipemail:prefs:${account.trim().toLowerCase() || "guest"}`;

/** True for a signed-in Google account, false for the public demo and the logged-out pages. */
export const isRealAccount = (account: string) => account !== "demo" && account !== "guest" && account.includes("@");
