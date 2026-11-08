/**
 * Decides whether a key press should be left alone instead of triggering a shortcut:
 * - it is part of a browser or system shortcut (Ctrl, Cmd or Alt held down),
 * - the user is typing or adjusting a form control (text box, slider, dropdown), or
 * - a dialog is open (Settings, Help, the email reader), because the keys belong to that dialog.
 */
export function shouldIgnoreShortcut(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return true;

  const t = e.target as HTMLElement | null;
  if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return true;

  return typeof document !== "undefined" && document.querySelector('[role="dialog"]') !== null;
}
