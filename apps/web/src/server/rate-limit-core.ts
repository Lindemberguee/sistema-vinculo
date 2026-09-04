/**
 * Pure rate-limit decision logic — no Redis, no framework. Kept separate so it
 * can be unit-tested without a running Redis.
 */

export interface RateVerdict {
  ok: boolean;
  limit: number;
  /** Requests still allowed in the current window (0 when over). */
  remaining: number;
  /** Seconds the caller should wait before retrying (0 when allowed). */
  retryAfterSec: number;
}

/**
 * @param count       the running counter value AFTER incrementing for this hit
 * @param limit       max hits allowed per window
 * @param remainingMs milliseconds left in the current window (from PTTL)
 */
export function rateLimitVerdict(count: number, limit: number, remainingMs: number): RateVerdict {
  const ok = count <= limit;
  return {
    ok,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfterSec: ok ? 0 : Math.max(1, Math.ceil(Math.max(remainingMs, 0) / 1000)),
  };
}

/** Build a namespaced Redis key, collapsing whitespace so header values are safe. */
export function bucketKey(...parts: (string | number | null | undefined)[]): string {
  return "rl:" + parts.map((p) => String(p ?? "-").replace(/\s+/g, "_")).join(":");
}

/** First hop of an `x-forwarded-for` chain, or a fallback token. */
export function firstForwardedIp(xff: string | null | undefined, realIp?: string | null): string {
  const first = xff?.split(",")[0]?.trim();
  if (first) return first;
  const real = realIp?.trim();
  return real || "unknown";
}
