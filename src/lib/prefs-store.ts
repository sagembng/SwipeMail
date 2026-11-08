"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_PREFS, LEGACY_PREFS_KEY, isRealAccount, parsePrefs, prefsStorageKey, type Prefs } from "./prefs";
import { usePrefsAccount } from "./prefs-scope";

/**
 * Preferences live in this browser only (localStorage), one set per account, so signing in as someone else on the same
 * browser never picks up the previous person's shortcuts or batch size. A small store shares them between components.
 */
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; prefs: Prefs }>();
const adopted = new Set<string>();

function read(account: string): Prefs {
  const key = prefsStorageKey(account);
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
    // Before accounts had their own settings there was one shared set. The first real account to open the app
    // takes it over, and the shared copy is removed so no other account can inherit it.
    if (raw === null && isRealAccount(account) && !adopted.has(key)) {
      adopted.add(key);
      const legacy = localStorage.getItem(LEGACY_PREFS_KEY);
      if (legacy !== null) {
        localStorage.setItem(key, legacy);
        localStorage.removeItem(LEGACY_PREFS_KEY);
        raw = legacy;
      }
    }
  } catch {
    /* storage blocked: use whatever is in memory */
    return cache.get(key)?.prefs ?? DEFAULT_PREFS;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.prefs;
  const prefs = parsePrefs(raw);
  cache.set(key, { raw, prefs });
  return prefs;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = () => onChange();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Current preferences for an account, for use outside React (for example inside a fetch). */
export const readPrefs = read;

/** Saves a whole set of preferences for one account. Invalid values are corrected. */
export function savePrefs(account: string, next: Prefs) {
  const prefs = parsePrefs(JSON.stringify(next));
  const raw = JSON.stringify(prefs);
  try {
    localStorage.setItem(prefsStorageKey(account), raw);
  } catch {
    /* ignore: the change still applies for this visit */
  }
  cache.set(prefsStorageKey(account), { raw, prefs });
  listeners.forEach((l) => l());
}

/** Live preferences of the account set by <PrefsScope>. The server renders the defaults; the browser's saved values take over. */
export function usePrefs(): Prefs {
  const account = usePrefsAccount();
  return useSyncExternalStore(
    subscribe,
    () => read(account),
    () => DEFAULT_PREFS,
  );
}
