"use client";

import { useSyncExternalStore } from "react";
import { usePrefsAccount } from "@/lib/prefs-scope";
import { applyTheme, saveTheme } from "@/lib/theme-store";
import type { Theme } from "@/lib/theme";
import { MonitorIcon, MoonIcon, SunIcon } from "./icons";
import s from "./ThemeToggle.module.css";


/** The <html data-theme> attribute is the source of truth. The inline script in layout.tsx sets it before paint. */
function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}
function getSnapshot(): Theme {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "light" || t === "dark" ? t : "system";
}
function getServerSnapshot(): Theme {
  return "system";
}

const ITEMS: { t: Theme; label: string; icon: React.ReactNode }[] = [
  { t: "system", label: "Match system theme", icon: <MonitorIcon /> },
  { t: "light", label: "Light theme", icon: <SunIcon /> },
  { t: "dark", label: "Dark theme", icon: <MoonIcon /> },
];

const SHORT: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

/** `labelled` shows a word next to each icon (used in the settings menu). */
export default function ThemeToggle({ labelled = false }: { labelled?: boolean }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const account = usePrefsAccount();

  // Applies the theme now and remembers it for this account only.
  const choose = (t: Theme) => {
    applyTheme(t);
    saveTheme(account, t);
  };

  return (
    <div className={`${s.seg} ${labelled ? s.labelled : ""} glass`} role="group" aria-label="Theme">
      {ITEMS.map((i) => (
        <button
          key={i.t}
          type="button"
          aria-label={i.label}
          title={i.label}
          aria-pressed={theme === i.t}
          onClick={() => choose(i.t)}
        >
          {i.icon}
          {labelled && <span>{SHORT[i.t]}</span>}
        </button>
      ))}
    </div>
  );
}
