"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the full-screen logo loader is up because of a sign-in or sign-out, and what it says.
 * Any component can call showLoader(); AppLoader (in the root layout) draws it and removes it when the page changes.
 */
export interface LoaderState {
  visible: boolean;
  message: string | null;
}

const HIDDEN: LoaderState = { visible: false, message: null };
let state: LoaderState = HIDDEN;
let shownAt = 0;
const listeners = new Set<() => void>();

function set(next: LoaderState) {
  state = next;
  listeners.forEach((l) => l());
}

export function showLoader(message: string) {
  shownAt = Date.now();
  set({ visible: true, message });
}

/** Hides the loader, but never sooner than `minMs` after it appeared, so it does not just flash. */
export function hideLoader(minMs = 700) {
  if (!state.visible) return;
  const wait = Math.max(0, minMs - (Date.now() - shownAt));
  window.setTimeout(() => set(HIDDEN), wait);
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function useLoader(): LoaderState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => HIDDEN,
  );
}
