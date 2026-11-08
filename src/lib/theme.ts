/** Light, dark or system theme, kept per account. Pure helpers (see theme.test.ts). */

export type Theme = "system" | "light" | "dark";

/** The single, shared key used before the theme was kept per account. */
export const LEGACY_THEME_KEY = "swipemail-theme";

/** Remembers which account used the app last, so the right theme can be applied before the page is drawn. */
export const LAST_ACCOUNT_KEY = "swipemail:last-account";

/** Where one account's theme is saved. "guest" is the login page and the walkthrough, "demo" is the public demo. */
export const themeStorageKey = (account: string) => `swipemail:theme:${account.trim().toLowerCase() || "guest"}`;

/** Anything that is not "light" or "dark" means "follow the system". */
export function parseTheme(raw: string | null): Theme {
  return raw === "light" || raw === "dark" ? raw : "system";
}
