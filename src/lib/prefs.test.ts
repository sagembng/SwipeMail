import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  BATCH_DEFAULT,
  DEFAULT_HOTKEYS,
  DEFAULT_PREFS,
  assignHotkey,
  clampBatch,
  keyLabel,
  normalizeKey,
  isRealAccount,
  parsePrefs,
  prefsStorageKey,
} from "./prefs.ts";

test("defaults: batch of 25 and the arrow keys", () => {
  assert.equal(DEFAULT_PREFS.batchSize, 25);
  assert.equal(BATCH_DEFAULT, 25);
  assert.equal(DEFAULT_HOTKEYS.read, "ArrowLeft");
});

test("clampBatch keeps 5 to 50 in steps of 5", () => {
  assert.equal(clampBatch(1), 5);
  assert.equal(clampBatch(99), 50);
  assert.equal(clampBatch(23), 25);
  assert.equal(clampBatch(NaN), 25);
});

test("keys are shown in a readable way", () => {
  assert.equal(keyLabel("ArrowLeft"), "←");
  assert.equal(keyLabel(" "), "Space");
  assert.equal(keyLabel("z"), "Z");
  assert.equal(normalizeKey("Z"), "z");
  assert.equal(normalizeKey("ArrowUp"), "ArrowUp");
});

test("assignHotkey accepts a free key", () => {
  const r = assignHotkey(DEFAULT_HOTKEYS, "read", "A");
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.hotkeys.read, "a");
});

test("assignHotkey refuses a key another action uses", () => {
  const r = assignHotkey(DEFAULT_HOTKEYS, "read", "z");
  assert.ok(!r.ok);
  if (!r.ok) assert.match(r.reason, /Undo/);
});

test("assignHotkey allows keeping an action's own key", () => {
  assert.ok(assignHotkey(DEFAULT_HOTKEYS, "undo", "Z").ok);
});

test("assignHotkey refuses keys the page needs", () => {
  assert.ok(!assignHotkey(DEFAULT_HOTKEYS, "read", "Escape").ok);
  assert.ok(!assignHotkey(DEFAULT_HOTKEYS, "read", "Tab").ok);
  assert.ok(!assignHotkey(DEFAULT_HOTKEYS, "read", "F5").ok);
});

test("parsePrefs falls back to defaults for missing or broken data", () => {
  assert.deepEqual(parsePrefs(null), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs("not json"), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs("[]"), DEFAULT_PREFS);
});

test("parsePrefs keeps valid saved values", () => {
  const p = parsePrefs(JSON.stringify({ hotkeys: { read: "a", star: "s" }, batchSize: 40 }));
  assert.equal(p.hotkeys.read, "a");
  assert.equal(p.hotkeys.star, "s");
  assert.equal(p.hotkeys.undo, "z");
  assert.equal(p.batchSize, 40);
});

test("parsePrefs never lets two actions share a key", () => {
  // read:"z" collides with the default undo:"z", so everything resets rather than leaving two actions on one key.
  const p = parsePrefs(JSON.stringify({ hotkeys: { read: "z" }, batchSize: 10 }));
  assert.deepEqual(p.hotkeys, DEFAULT_HOTKEYS);
  assert.equal(p.batchSize, 10);
});

test("parsePrefs clamps a tampered batch size", () => {
  assert.equal(parsePrefs(JSON.stringify({ batchSize: 100000 })).batchSize, 50);
  assert.equal(parsePrefs(JSON.stringify({ batchSize: "lots" })).batchSize, 25);
});

test("haptics default to on and can be turned off", () => {
  assert.equal(DEFAULT_PREFS.haptics, true);
  assert.equal(parsePrefs(JSON.stringify({ haptics: false })).haptics, false);
  assert.equal(parsePrefs(JSON.stringify({ haptics: "no" })).haptics, true);
});

test("every account has its own storage key", () => {
  assert.notEqual(prefsStorageKey("ana@gmail.com"), prefsStorageKey("ben@gmail.com"));
  assert.notEqual(prefsStorageKey("demo"), prefsStorageKey("ana@gmail.com"));
});

test("the storage key ignores letter case and spaces in the email", () => {
  assert.equal(prefsStorageKey("  Ana@Gmail.com "), prefsStorageKey("ana@gmail.com"));
  assert.equal(prefsStorageKey(""), prefsStorageKey("guest"));
});

test("only a signed-in Google account counts as a real account", () => {
  assert.ok(isRealAccount("ana@gmail.com"));
  assert.ok(!isRealAccount("demo"));
  assert.ok(!isRealAccount("guest"));
});
