import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseTheme, themeStorageKey } from "./theme.ts";

test("every account has its own theme key", () => {
  assert.notEqual(themeStorageKey("ana@gmail.com"), themeStorageKey("ben@gmail.com"));
  assert.notEqual(themeStorageKey("demo"), themeStorageKey("guest"));
});

test("the theme key ignores letter case and spaces", () => {
  assert.equal(themeStorageKey("  Ana@Gmail.com "), themeStorageKey("ana@gmail.com"));
  assert.equal(themeStorageKey(""), themeStorageKey("guest"));
});

test("parseTheme accepts light and dark, and treats anything else as system", () => {
  assert.equal(parseTheme("light"), "light");
  assert.equal(parseTheme("dark"), "dark");
  assert.equal(parseTheme(null), "system");
  assert.equal(parseTheme("purple"), "system");
});
