/** Remembers, in this browser only, that the welcome tour has been seen. Works with useSyncExternalStore. */
const KEY = "swipemail:onboarded";
const listeners = new Set<() => void>();

export function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function getOnboarded(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true; // storage blocked: do not nag on every visit
  }
}

/** On the server there is no storage. Reporting "seen" keeps the dialog out of the server-rendered page. */
export const getOnboardedOnServer = () => true;

export function markOnboarded() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}
