import { describe, expect, it } from "vitest";
import { drawWinnerIndex, pickFreeNumbers, validateNumberSelection } from "./logic";

describe("pickFreeNumbers", () => {
  it("returns the requested quantity of free, in-range, sorted, unique numbers", () => {
    const taken = new Set([2, 4, 6, 8, 10]);
    const got = pickFreeNumbers(10, taken, 3, "seed-a");
    expect(got).toHaveLength(3);
    expect(new Set(got).size).toBe(3);
    for (const n of got) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(10);
      expect(taken.has(n)).toBe(false);
    }
    expect([...got]).toEqual([...got].sort((a, b) => a - b));
  });

  it("is deterministic for a given seed", () => {
    const a = pickFreeNumbers(1000, [], 20, "abc");
    const b = pickFreeNumbers(1000, [], 20, "abc");
    expect(a).toEqual(b);
  });

  it("gives different results for different seeds", () => {
    const a = pickFreeNumbers(1000, [], 20, "abc");
    const b = pickFreeNumbers(1000, [], 20, "xyz");
    expect(a).not.toEqual(b);
  });

  it("can drain the whole pool exactly", () => {
    const got = pickFreeNumbers(50, [], 50, "s");
    expect(got).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  it("throws when not enough numbers are free", () => {
    expect(() => pickFreeNumbers(5, [1, 2, 3], 3, "s")).toThrow(/available/);
  });
});

describe("validateNumberSelection", () => {
  it("accepts a valid selection", () => {
    expect(validateNumberSelection(100, [50], [1, 2, 99])).toEqual({ ok: true });
  });
  it("rejects out-of-range, repeated and taken numbers", () => {
    expect(validateNumberSelection(10, [], [0]).ok).toBe(false);
    expect(validateNumberSelection(10, [], [11]).ok).toBe(false);
    expect(validateNumberSelection(10, [], [3, 3]).ok).toBe(false);
    expect(validateNumberSelection(10, [5], [5]).ok).toBe(false);
    expect(validateNumberSelection(10, [], []).ok).toBe(false);
  });
});

describe("drawWinnerIndex", () => {
  it("is deterministic and within [0, paidCount)", () => {
    for (const count of [1, 2, 7, 100, 999]) {
      const idx = drawWinnerIndex("federal-2024-01-01", count);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(count);
      expect(drawWinnerIndex("federal-2024-01-01", count)).toBe(idx);
    }
  });
  it("rejects an empty pool", () => {
    expect(() => drawWinnerIndex("s", 0)).toThrow();
  });
});
