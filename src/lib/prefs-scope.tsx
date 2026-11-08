"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { isRealAccount } from "./prefs";
import { applyTheme, readTheme, rememberAccount } from "./theme-store";

/**
 * Says whose preferences the components below are showing and saving: the signed-in email, "demo" for the public
 * demo, or "guest" anywhere else (login page, walkthrough). Each one has its own saved settings.
 */
const PrefsAccount = createContext<string>("guest");

export function PrefsScope({ account, children }: { account: string; children: ReactNode }) {
  // Whenever a different account takes over (or the login page opens), show that account's own light or dark theme.
  useEffect(() => {
    applyTheme(readTheme(account));
    if (isRealAccount(account)) rememberAccount(account);
  }, [account]);

  return <PrefsAccount.Provider value={account}>{children}</PrefsAccount.Provider>;
}

export const usePrefsAccount = () => useContext(PrefsAccount);
