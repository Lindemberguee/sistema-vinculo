import { describe, expect, it } from "vitest";
import { bucketKey, firstForwardedIp, rateLimitVerdict } from "./rate-limit-core";

describe("rateLimitVerdict", () => {
  it("allows while count <= limit", () => {
    const v = rateLimitVerdict(3, 5, 40_000);
    expect(v.ok).toBe(true);
    expect(v.remaining).toBe(2);
    expect(v.retryAfterSec).toBe(0);
  });
  it("allows exactly at the limit", () => {
    expect(rateLimitVerdict(5, 5, 10_000).ok).toBe(true);
    expect(rateLimitVerdict(5, 5, 10_000).remaining).toBe(0);
  });
  it("blocks past the limit and rounds retry-after up to whole seconds", () => {
    const v = rateLimitVerdict(6, 5, 2100);
    expect(v.ok).toBe(false);
    expect(v.remaining).toBe(0);
    expect(v.retryAfterSec).toBe(3);
  });
  it("never returns retryAfter below 1s when blocked", () => {
    expect(rateLimitVerdict(9, 5, 0).retryAfterSec).toBe(1);
    expect(rateLimitVerdict(9, 5, -50).retryAfterSec).toBe(1);
  });
});

describe("bucketKey", () => {
  it("namespaces and joins with colons", () => {
    expect(bucketKey("login", "1.2.3.4")).toBe("rl:login:1.2.3.4");
  });
  it("substitutes missing parts and collapses whitespace", () => {
    expect(bucketKey("x", undefined, "a b")).toBe("rl:x:-:a_b");
  });
});

describe("firstForwardedIp", () => {
  it("takes the first hop of x-forwarded-for", () => {
    expect(firstForwardedIp("203.0.113.9, 70.41.3.18, 150.172.238.178")).toBe("203.0.113.9");
  });
  it("falls back to x-real-ip then 'unknown'", () => {
    expect(firstForwardedIp(null, "198.51.100.7")).toBe("198.51.100.7");
    expect(firstForwardedIp(undefined, undefined)).toBe("unknown");
    expect(firstForwardedIp("   ", "  ")).toBe("unknown");
  });
});
