import { describe, expect, it } from "vitest";
import { addInterval } from "./index";

describe("addInterval", () => {
  it("clamps monthly dates to the last day of shorter months", () => {
    expect(addInterval(new Date("2025-01-31T12:00:00Z"), "MONTHLY").toISOString()).toBe("2025-02-28T12:00:00.000Z");
  });

  it("clamps leap-day yearly recurrence in non-leap years", () => {
    expect(addInterval(new Date("2024-02-29T12:00:00Z"), "YEARLY").toISOString()).toBe("2025-02-28T12:00:00.000Z");
  });
});
