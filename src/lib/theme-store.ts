"use client";

import { isRealAccount } from "./prefs";
import { LAST_ACCOUNT_KEY, LEGACY_THEME_KEY, parseTheme, themeStorageKey, type Theme } from "./theme";

/** Browser-side reading, saving and applying of the per-account theme. The <html data-theme> attribute is what the CSS follows. */

export function readTheme(account: string): Theme {
  try {
    const key = themeStorageKey(account);
    let raw = localStorage.getItem(key);
    // Before the theme was per account there was one shared choice. The first real account takes it over,
    // and the shared copy is removed so no other account inherits it.
    if (raw === null && isRealAccount(account)) {
      const legacy = localStorage.getItem(LEGACY_THEME_KEY);
      if (legacy !== null) {
        localStorage.setItem(key, legacy);
        localStorage.removeItem(LEGACY_THEME_KEY);
        raw = legacy;
      }
    }
    return parseTheme(raw);
  } catch {
    return "system";
  }
}

export function saveTheme(account: string, theme: Theme) {
  try {
    const key = themeStorageKey(account);
    if (theme === "system") localStorage.removeItem(key);
    else localStorage.setItem(key, theme);
  } catch {
    /* storage unavailable: the choice still applies for this visit */
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function rememberAccount(account: string) {
  try {
    localStorage.setItem(LAST_ACCOUNT_KEY, account.trim().toLowerCase());
  } catch {
    /* ignore */
  }
}
