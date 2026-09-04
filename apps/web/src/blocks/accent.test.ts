import { describe, it, expect } from "vitest";
import { contrast, resolveAccent, DEFAULT_ACCENT } from "./accent";

describe("accent contrast guard", () => {
  it("falls back to the brand green on bad input", () => {
    expect(resolveAccent("").accent).toBe(DEFAULT_ACCENT.toLowerCase());
    expect(resolveAccent("nope").accent).toBe(DEFAULT_ACCENT.toLowerCase());
    expect(resolveAccent(null).accent).toBe(DEFAULT_ACCENT.toLowerCase());
  });

  it("onAccent picks the higher-contrast text colour for a fill", () => {
    expect(resolveAccent("#006B4F").onAccent).toBe("#ffffff"); // dark green → white
    expect(resolveAccent("#f4d03f").onAccent).toBe("#17201c"); // bright yellow → ink
  });

  it("textInk clears 4.5:1 on white even when the raw accent doesn't", () => {
    const bright = resolveAccent("#2f9e44"); // vivid green, ~2.5:1 on white
    expect(bright.lowContrastOnWhite).toBe(true);
    expect(contrast(bright.textInk, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(bright.accent).toBe("#2f9e44"); // fill stays the tenant's colour
  });

  it("a compliant accent keeps textInk === accent", () => {
    const ok = resolveAccent("#006B4F");
    expect(ok.lowContrastOnWhite).toBe(false);
    expect(ok.textInk).toBe("#006b4f");
  });

  it("wash/soft are near-white tints and ring carries alpha", () => {
    const p = resolveAccent("#1f6feb");
    expect(contrast(p.wash, "#ffffff")).toBeLessThan(1.3); // barely off white
    expect(p.ring).toMatch(/^#[0-9a-f]{6}80$/);
  });

  it("contrast ratio is symmetric and bounded", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 0);
    expect(contrast("#006B4F", "#006B4F")).toBeCloseTo(1, 5);
  });
});
