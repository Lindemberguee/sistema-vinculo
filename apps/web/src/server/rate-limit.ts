import "server-only";
import IORedis from "ioredis";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { bucketKey, firstForwardedIp, rateLimitVerdict, type RateVerdict } from "./rate-limit-core";

export { bucketKey };

/**
 * Redis fixed-window rate limiter. Fail-open: any Redis problem (unreachable,
 * slow, misconfigured) returns "allowed" and logs — a limiter must never take
 * the site down. Uses its own lazy connection, separate from the BullMQ one.
 */

const g = globalThis as unknown as { __rlRedis?: IORedis | null };

function getClient(): IORedis | null {
  if (g.__rlRedis !== undefined) return g.__rlRedis;
  const url = process.env.REDIS_URL;
  if (!url) return (g.__rlRedis = null);
  try {
    const client = new IORedis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 1500,
      retryStrategy: () => null, // don't reconnect-storm; we fail open instead
    });
    client.on("error", (e) => console.warn("[rate-limit] redis:", e.message));
    g.__rlRedis = client;
    return client;
  } catch (e) {
    console.warn("[rate-limit] redis init failed:", (e as Error).message);
    return (g.__rlRedis = null);
  }
}

// INCR the counter, set the window TTL on first hit, read the TTL back — one round trip.
const LUA = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return {c, redis.call('PTTL', KEYS[1])}
`;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("rate-limit timeout")), ms)),
  ]);
}

// Circuit breaker: after a run of failures, stop touching Redis for a cool-off
// so a degraded/unreachable store doesn't add latency to every request.
const breaker = { fails: 0, openUntil: 0 };
const BREAKER_THRESHOLD = 5;
const BREAKER_COOL_OFF_MS = 30_000;

/** Increment the bucket and decide. Never throws. */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateVerdict> {
  const allow: RateVerdict = { ok: true, limit, remaining: limit, retryAfterSec: 0 };
  const client = getClient();
  if (!client) return allow;
  if (Date.now() < breaker.openUntil) return allow;

  try {
    if (client.status !== "ready" && client.status !== "connecting" && client.status !== "connect") {
      await withTimeout(client.connect(), 1500).catch(() => {});
    }
    const res = (await withTimeout(client.eval(LUA, 1, key, String(windowSec * 1000)), 900)) as [number, number];
    const [count, ttlMs] = res;
    breaker.fails = 0;
    return rateLimitVerdict(count, limit, ttlMs > 0 ? ttlMs : windowSec * 1000);
  } catch (e) {
    breaker.fails += 1;
    if (breaker.fails >= BREAKER_THRESHOLD) {
      breaker.openUntil = Date.now() + BREAKER_COOL_OFF_MS;
      breaker.fails = 0;
      console.warn("[rate-limit] Redis unhealthy — bypassing rate limits for 30s");
    } else {
      console.warn("[rate-limit] failing open:", (e as Error).message);
    }
    return allow;
  }
}

/** `[limit, windowSeconds]` per protected operation. */
export const RL = {
  register: [5, 600],
  passwordResetIp: [5, 600],
  passwordResetTarget: [4, 3600],
  resendVerification: [3, 600],
  changePassword: [5, 600],
  login: [10, 600],
  donation: [20, 60],
  publicLookup: [120, 60],
  ambassadorCreate: [5, 3600],
  inviteAccept: [30, 600],
  inviteSend: [40, 3600],
  emailTest: [10, 600],
} as const satisfies Record<string, readonly [number, number]>;

export type RateLimitName = keyof typeof RL;

/** Client IP from a Route Handler's Request. */
export function ipFromRequest(req: Request): string {
  return firstForwardedIp(req.headers.get("x-forwarded-for"), req.headers.get("x-real-ip"));
}

/** Client IP from the ambient request headers (Server Actions / RSC). */
export async function ipFromHeaders(): Promise<string> {
  const h = await headers();
  return firstForwardedIp(h.get("x-forwarded-for"), h.get("x-real-ip"));
}

const TOO_MANY = {
  error: "rate_limited",
  message: "Muitas tentativas. Aguarde alguns instantes e tente de novo.",
} as const;

/**
 * Route-handler guard: returns a 429 `NextResponse` when over the limit, else
 * null. `scope` further partitions the bucket (e.g. a campaign slug).
 */
export async function enforceRoute(
  req: Request,
  name: RateLimitName,
  scope?: string,
): Promise<NextResponse | null> {
  const [limit, windowSec] = RL[name];
  const v = await rateLimit(bucketKey(name, ipFromRequest(req), scope), limit, windowSec);
  if (v.ok) return null;
  return NextResponse.json(TOO_MANY, {
    status: 429,
    headers: { "Retry-After": String(v.retryAfterSec), "Cache-Control": "no-store" },
  });
}

/** Server-action guard: true = allowed, false = over the limit. */
export async function checkActionLimit(name: RateLimitName, scope?: string): Promise<boolean> {
  const [limit, windowSec] = RL[name];
  const v = await rateLimit(bucketKey(name, await ipFromHeaders(), scope), limit, windowSec);
  return v.ok;
}

/** As checkActionLimit but keyed on an explicit identifier instead of the IP. */
export async function checkActionLimitFor(name: RateLimitName, identifier: string): Promise<boolean> {
  const [limit, windowSec] = RL[name];
  const v = await rateLimit(bucketKey(name, "id", identifier), limit, windowSec);
  return v.ok;
}

export const RATE_LIMIT_MESSAGE = TOO_MANY.message;
