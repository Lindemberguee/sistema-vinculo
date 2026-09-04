import { describe, expect, it } from "vitest";
import { expiryFor, identifierFor, isExpired, newToken, parseIdentifier } from "./tokens";

describe("identifierFor / parseIdentifier", () => {
  it("round-trips and lowercases the email", () => {
    const id = identifierFor("verify", "Alice@Example.com");
    expect(id).toBe("verify:alice@example.com");
    expect(parseIdentifier(id)).toEqual({ kind: "verify", email: "alice@example.com" });
  });
  it("handles emails containing a colon-free plus tag", () => {
    expect(parseIdentifier("pwreset:a+b@x.com")).toEqual({ kind: "pwreset", email: "a+b@x.com" });
  });
  it("rejects unknown kinds and malformed input", () => {
    expect(parseIdentifier("magic:alice@example.com")).toBeNull();
    expect(parseIdentifier("no-colon")).toBeNull();
  });
});

describe("newToken", () => {
  it("is 64 hex chars and unique across a batch", () => {
    const set = new Set(Array.from({ length: 500 }, () => newToken()));
    expect(set.size).toBe(500);
    for (const t of set) expect(/^[0-9a-f]{64}$/.test(t)).toBe(true);
  });
});

describe("expiryFor / isExpired", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  it("verify tokens last 24h, reset tokens 1h", () => {
    expect(expiryFor("verify", now).toISOString()).toBe("2026-01-02T00:00:00.000Z");
    expect(expiryFor("pwreset", now).toISOString()).toBe("2026-01-01T01:00:00.000Z");
  });
  it("isExpired compares against now", () => {
    expect(isExpired(new Date("2026-01-01T00:59:00Z"), new Date("2026-01-01T01:00:00Z"))).toBe(true);
    expect(isExpired(new Date("2026-01-01T01:01:00Z"), new Date("2026-01-01T01:00:00Z"))).toBe(false);
  });
});
