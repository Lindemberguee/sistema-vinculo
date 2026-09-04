import { describe, expect, it } from "vitest";
import { formatIntl, isIntlCurrency, validateIntlAmount } from "./logic";

describe("isIntlCurrency", () => {
  it("accepts supported codes case-insensitively", () => {
    expect(isIntlCurrency("usd")).toBe(true);
    expect(isIntlCurrency("EUR")).toBe(true);
    expect(isIntlCurrency("BRL")).toBe(false);
    expect(isIntlCurrency("XYZ")).toBe(false);
  });
});

describe("validateIntlAmount", () => {
  it("accepts a valid amount and normalizes the currency", () => {
    expect(validateIntlAmount("usd", 2500)).toEqual({ ok: true, currency: "USD" });
  });
  it("rejects unsupported currency, below-minimum, non-positive, non-integer, over-limit", () => {
    expect(validateIntlAmount("brl", 2500).ok).toBe(false);
    expect(validateIntlAmount("USD", 100).ok).toBe(false);
    expect(validateIntlAmount("USD", 0).ok).toBe(false);
    expect(validateIntlAmount("USD", 10.5).ok).toBe(false);
    expect(validateIntlAmount("USD", 999_999_999).ok).toBe(false);
  });
});

describe("formatIntl", () => {
  it("formats minor units", () => {
    expect(formatIntl(2500, "USD")).toBe("$25.00");
  });
});
