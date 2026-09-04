import { describe, expect, it } from "vitest";
import { computeOrderCents, validateOrderItems, type TypeInfo } from "./logic";

const types: Record<string, TypeInfo> = {
  full: { priceCents: 5000, available: 100, maxPerOrder: 6 },
  half: { priceCents: 2500, available: 2, maxPerOrder: 6 },
};

describe("computeOrderCents", () => {
  it("sums price × quantity per type", () => {
    expect(computeOrderCents([{ ticketTypeId: "full", quantity: 2 }, { ticketTypeId: "half", quantity: 1 }], types)).toBe(12500);
  });
  it("throws on unknown type", () => {
    expect(() => computeOrderCents([{ ticketTypeId: "vip", quantity: 1 }], types)).toThrow();
  });
});

describe("validateOrderItems", () => {
  it("accepts a valid order and counts tickets", () => {
    const r = validateOrderItems([{ ticketTypeId: "full", quantity: 3 }], types);
    expect(r).toEqual({ ok: true, totalTickets: 3 });
  });
  it("rejects empty, over-limit, over-availability, repeated, and unknown", () => {
    expect(validateOrderItems([], types).ok).toBe(false);
    expect(validateOrderItems([{ ticketTypeId: "full", quantity: 0 }], types).ok).toBe(false);
    expect(validateOrderItems([{ ticketTypeId: "full", quantity: 7 }], types).ok).toBe(false);
    expect(validateOrderItems([{ ticketTypeId: "half", quantity: 3 }], types).ok).toBe(false); // available 2
    expect(validateOrderItems([{ ticketTypeId: "vip", quantity: 1 }], types).ok).toBe(false);
    expect(
      validateOrderItems([{ ticketTypeId: "full", quantity: 1 }, { ticketTypeId: "full", quantity: 1 }], types).ok,
    ).toBe(false);
  });
});
