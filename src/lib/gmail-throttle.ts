/**
 * Small tools that keep SwipeMail well inside Gmail's rate limits (about 250 quota units per second per user,
 * and downloading one email costs 5). Pure and dependency free, so they are unit tested (gmail-throttle.test.ts).
 */

/** Lets only `max` async jobs run at once; the rest wait in line. */
export class Semaphore {
  private active = 0;
  private queue: Array<() => void> = [];
  private readonly max: number;

  constructor(max: number) {
    this.max = max;
  }

  async run<T>(job: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
    try {
      return await job();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }
}

/** True when Gmail is telling us to slow down. */
export function isRateLimit(status: number, text: string): boolean {
  return status === 429 || (status === 403 && /rateLimit|quota/i.test(text));
}

/** How long to wait before trying again: Gmail's Retry-After if it sent one, otherwise 0.5s, 1s, 2s, 4s (plus a little jitter). */
export function retryDelayMs(attempt: number, retryAfter: string | null, random: () => number = Math.random): number {
  const fromHeader = retryAfter ? Number(retryAfter) * 1000 : NaN;
  if (Number.isFinite(fromHeader) && fromHeader > 0) return Math.min(fromHeader, 8000);
  return Math.min(8000, 500 * 2 ** attempt) + Math.floor(random() * 250);
}

/** A tiny in-memory cache whose entries expire, with a size limit. */
export class TtlCache<V> {
  private entries = new Map<string, { at: number; value: V }>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(ttlMs: number, maxEntries: number) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  get(key: string, now = Date.now()): V | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (now - hit.at > this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V, now = Date.now()): void {
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { at: now, value });
  }
}
