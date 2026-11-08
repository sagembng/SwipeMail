import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Semaphore, TtlCache, isRateLimit, retryDelayMs } from "./gmail-throttle.ts";

test("Semaphore never runs more than its limit at once", async () => {
  const sem = new Semaphore(3);
  let running = 0;
  let peak = 0;
  const job = async () => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 5));
    running--;
  };
  await Promise.all(Array.from({ length: 20 }, () => sem.run(job)));
  assert.equal(peak, 3);
});

test("Semaphore keeps working after a job fails", async () => {
  const sem = new Semaphore(1);
  await assert.rejects(sem.run(async () => Promise.reject(new Error("boom"))));
  assert.equal(await sem.run(async () => "still works"), "still works");
});

test("isRateLimit recognises Gmail's rate limit answers", () => {
  assert.ok(isRateLimit(429, ""));
  assert.ok(isRateLimit(403, "User-rate limit exceeded. rateLimitExceeded"));
  assert.ok(isRateLimit(403, "Quota exceeded for quota metric"));
  assert.ok(!isRateLimit(403, "insufficientPermissions"));
  assert.ok(!isRateLimit(500, "rateLimit"));
});

test("retryDelayMs backs off and honours Retry-After", () => {
  const none = () => 0;
  assert.equal(retryDelayMs(0, null, none), 500);
  assert.equal(retryDelayMs(1, null, none), 1000);
  assert.equal(retryDelayMs(2, null, none), 2000);
  assert.equal(retryDelayMs(10, null, none), 8000);
  assert.equal(retryDelayMs(0, "3", none), 3000);
  assert.equal(retryDelayMs(0, "999", none), 8000);
  assert.equal(retryDelayMs(0, "soon", none), 500);
});

test("TtlCache expires entries and respects its size limit", () => {
  const c = new TtlCache<string>(1000, 2);
  c.set("a", "1", 0);
  assert.equal(c.get("a", 500), "1");
  assert.equal(c.get("a", 1500), undefined);
  c.set("x", "1", 0);
  c.set("y", "2", 0);
  c.set("z", "3", 0);
  assert.equal(c.get("x", 1), undefined);
  assert.equal(c.get("z", 1), "3");
});
