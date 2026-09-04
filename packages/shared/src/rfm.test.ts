import { describe, expect, it } from "vitest";
import { scorePopulation, type RfmMetrics } from "./rfm";

describe("scorePopulation", () => {
  it("returns empty for empty population", () => {
    expect(scorePopulation([])).toEqual([]);
  });

  it("scores the most recent, frequent, high-value donor as Campeões", () => {
    const pop: RfmMetrics[] = [];
    for (let i = 0; i < 20; i++) {
      pop.push({ recencyDays: 300 - i, frequency: 1 + i, monetaryCents: (1 + i) * 1000 });
    }
    const scores = scorePopulation(pop);
    const best = scores[scores.length - 1]!; // most recent + most frequent + highest value
    expect(best.r).toBe(5);
    expect(best.f).toBe(5);
    expect(best.m).toBe(5);
    expect(best.segment).toBe("Campeões");
  });

  it("scores an old, one-off, low-value donor as Perdidos", () => {
    const pop: RfmMetrics[] = [];
    for (let i = 0; i < 20; i++) {
      pop.push({ recencyDays: 10 + i * 10, frequency: 10 - Math.floor(i / 3), monetaryCents: (20 - i) * 1000 });
    }
    const scores = scorePopulation(pop);
    const worst = scores[scores.length - 1]!;
    expect(worst.r).toBe(1);
    expect(worst.segment).toBe("Perdidos");
  });

  it("keeps every score within 1..5 and same length as input", () => {
    const pop = Array.from({ length: 137 }, (_, i) => ({
      recencyDays: (i * 7) % 400,
      frequency: (i * 3) % 25,
      monetaryCents: ((i * 131) % 5000) * 100,
    }));
    const scores = scorePopulation(pop);
    expect(scores).toHaveLength(pop.length);
    for (const s of scores) {
      for (const v of [s.r, s.f, s.m]) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(5);
      }
    }
  });
});
