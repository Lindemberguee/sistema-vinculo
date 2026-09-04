import { describe, expect, it } from "vitest";
import { isAmbassadorSlug, randomSuffix, slugifyName } from "./slug";

describe("slugifyName", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyName("Maria Silva")).toBe("maria-silva");
  });
  it("strips accents", () => {
    expect(slugifyName("João Conceição")).toBe("joao-conceicao");
    expect(slugifyName("Ângela Muñoz")).toBe("angela-munoz");
  });
  it("collapses runs of punctuation and trims edges", () => {
    expect(slugifyName("  --Ana   B. C!!--  ")).toBe("ana-b-c");
  });
  it("caps length and never ends with a hyphen", () => {
    const s = slugifyName("a".repeat(80));
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
  });
  it("falls back to 'apoiador' when nothing usable remains", () => {
    expect(slugifyName("——")).toBe("apoiador");
    expect(slugifyName("😀")).toBe("apoiador");
  });
});

describe("randomSuffix", () => {
  it("has the requested length and a safe alphabet", () => {
    for (let i = 0; i < 200; i += 1) {
      const s = randomSuffix(4);
      expect(s).toHaveLength(4);
      expect(/^[2-9a-hjkmnp-z]{4}$/.test(s)).toBe(true);
    }
  });
});

describe("isAmbassadorSlug", () => {
  it("accepts slugify output with or without a suffix", () => {
    expect(isAmbassadorSlug("maria-silva")).toBe(true);
    expect(isAmbassadorSlug("maria-silva-2k7p")).toBe(true);
  });
  it("rejects junk", () => {
    expect(isAmbassadorSlug("Maria Silva")).toBe(false);
    expect(isAmbassadorSlug("-x")).toBe(false);
    expect(isAmbassadorSlug("a")).toBe(false);
    expect(isAmbassadorSlug("x".repeat(61))).toBe(false);
  });
});
