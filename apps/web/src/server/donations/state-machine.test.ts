import { describe, expect, it } from "vitest";
import { aggregateDelta, canTransition } from "./state-machine";

describe("donation state machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("CREATED", "PENDING")).toBe(true);
    expect(canTransition("PENDING", "PAID")).toBe(true);
    expect(canTransition("PAID", "REFUNDED")).toBe(true);
    expect(canTransition("PAID", "CHARGED_BACK")).toBe(true);
  });

  it("forbids skipping and illegal moves", () => {
    expect(canTransition("CREATED", "PAID")).toBe(false);
    expect(canTransition("PAID", "PENDING")).toBe(false);
    expect(canTransition("REFUNDED", "PAID")).toBe(false);
    expect(canTransition("EXPIRED", "PAID")).toBe(false);
    expect(canTransition("PAID", "PAID")).toBe(false);
  });

  it("moves aggregates only in/out of PAID", () => {
    expect(aggregateDelta("PENDING", "PAID")).toBe(1);
    expect(aggregateDelta("PAID", "REFUNDED")).toBe(-1);
    expect(aggregateDelta("PAID", "CHARGED_BACK")).toBe(-1);
    expect(aggregateDelta("CREATED", "PENDING")).toBe(0);
    expect(aggregateDelta("PENDING", "FAILED")).toBe(0);
    expect(aggregateDelta("REFUNDED", "PAID")).toBe(1); // guarded elsewhere by canTransition
  });
});
