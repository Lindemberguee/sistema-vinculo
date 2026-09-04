import { describe, expect, it } from "vitest";
import { extendedEndsAt, lotHasEnded, minNextBidCents, validateBid } from "./logic";

describe("minNextBidCents", () => {
  it("is the start price when there are no bids", () => {
    expect(minNextBidCents(null, 10000, 500)).toBe(10000);
  });
  it("is current + increment when there are bids", () => {
    expect(minNextBidCents(10000, 10000, 500)).toBe(10500);
  });
});

describe("validateBid", () => {
  it("accepts a bid at or above the minimum", () => {
    expect(validateBid(10500, 10500)).toEqual({ ok: true });
    expect(validateBid(20000, 10500)).toEqual({ ok: true });
  });
  it("rejects below minimum and non-positive/non-integer", () => {
    expect(validateBid(10000, 10500).ok).toBe(false);
    expect(validateBid(0, 100).ok).toBe(false);
    expect(validateBid(10.5, 1).ok).toBe(false);
  });
});

describe("extendedEndsAt (anti-snipe)", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  it("extends when a bid lands inside the window", () => {
    const endsAt = new Date(now.getTime() + 30_000); // 30s left
    const ext = extendedEndsAt(endsAt, now, 120);
    expect(ext).not.toBeNull();
    expect(ext!.getTime()).toBe(now.getTime() + 120_000);
  });
  it("does not extend when there is plenty of time left", () => {
    const endsAt = new Date(now.getTime() + 10 * 60_000);
    expect(extendedEndsAt(endsAt, now, 120)).toBeNull();
  });
  it("extends exactly at the boundary", () => {
    const endsAt = new Date(now.getTime() + 120_000);
    expect(extendedEndsAt(endsAt, now, 120)).not.toBeNull();
  });
});

describe("lotHasEnded", () => {
  it("true once now reaches endsAt", () => {
    const t = new Date("2026-01-01T12:00:00Z");
    expect(lotHasEnded(t, new Date(t.getTime() - 1))).toBe(false);
    expect(lotHasEnded(t, t)).toBe(true);
    expect(lotHasEnded(t, new Date(t.getTime() + 1))).toBe(true);
  });
});
