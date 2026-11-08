import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isSecureRequest } from "./cookies.ts";

test("a request forwarded as https is secure (Vercel)", () => {
  assert.ok(isSecureRequest(new Headers({ "x-forwarded-proto": "https" })));
});

test("a request forwarded as http is not secure (local development)", () => {
  assert.ok(!isSecureRequest(new Headers({ "x-forwarded-proto": "http" })));
});

test("only the first forwarded protocol counts", () => {
  assert.ok(isSecureRequest(new Headers({ "x-forwarded-proto": "https,http" })));
  assert.ok(!isSecureRequest(new Headers({ "x-forwarded-proto": "http, https" })));
});

test("without the header, localhost is not secure", () => {
  assert.ok(!isSecureRequest(new Headers()));
});

test("without the header, an https AUTH_URL makes it secure", () => {
  assert.ok(isSecureRequest(new Headers(), "https://swipemail.vercel.app"));
  assert.ok(!isSecureRequest(new Headers(), "http://localhost:3000"));
});

test("the header wins over AUTH_URL", () => {
  assert.ok(!isSecureRequest(new Headers({ "x-forwarded-proto": "http" }), "https://swipemail.vercel.app"));
});
