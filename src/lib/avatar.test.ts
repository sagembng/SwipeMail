import { strict as assert } from "node:assert";
import { test } from "node:test";
import { avatarCandidates, gravatarUrl, isEmail, isGenericProvider, isGoogleImageHost, rootDomain, sizedGoogleImage } from "./avatar.ts";

test("rootDomain strips subdomains", () => {
  assert.equal(rootDomain("notifications@mail.stripe.com"), "stripe.com");
  assert.equal(rootDomain("Team@Linear.app"), "linear.app");
});

test("rootDomain keeps country-style domains whole", () => {
  assert.equal(rootDomain("news@email.bbc.co.uk"), "bbc.co.uk");
});

test("rootDomain rejects things that are not addresses", () => {
  assert.equal(rootDomain("not an email"), null);
  assert.equal(rootDomain("a@b"), null);
  assert.equal(rootDomain("x@evil.com/../../etc"), null);
});

test("isEmail is strict enough to keep URLs out", () => {
  assert.ok(isEmail("priya@acme.example"));
  assert.ok(!isEmail("http://evil.example"));
  assert.ok(!isEmail("a@b.com\nHost: x"));
});

test("free mailbox providers get no site logo", () => {
  assert.ok(isGenericProvider("gmail.com"));
  assert.equal(avatarCandidates("friend@gmail.com").length, 1);
  assert.ok(avatarCandidates("billing@stripe.com").length > 1);
});

test("gravatar url uses a lowercase sha256 hash and asks for a 404 when missing", () => {
  const url = gravatarUrl("  Priya@Acme.Example ");
  assert.match(url, /^https:\/\/www\.gravatar\.com\/avatar\/[0-9a-f]{64}\?s=128&d=404$/);
  assert.equal(url, gravatarUrl("priya@acme.example"));
});

test("only Google image hosts are allowed for profile pictures", () => {
  assert.ok(isGoogleImageHost("https://lh3.googleusercontent.com/a/abc=s96-c"));
  assert.ok(!isGoogleImageHost("http://lh3.googleusercontent.com/a/abc"));
  assert.ok(!isGoogleImageHost("https://evil.example/googleusercontent.com"));
  assert.ok(!isGoogleImageHost("https://googleusercontent.com.evil.example/x"));
});

test("profile picture size is normalised", () => {
  assert.equal(sizedGoogleImage("https://lh3.googleusercontent.com/a/abc=s96-c"), "https://lh3.googleusercontent.com/a/abc=s128-c");
  assert.equal(sizedGoogleImage("https://lh3.googleusercontent.com/a/abc"), "https://lh3.googleusercontent.com/a/abc");
});
