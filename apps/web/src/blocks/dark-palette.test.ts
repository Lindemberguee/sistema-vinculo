import { describe, it, expect } from "vitest";
import { contrast } from "./accent";

/**
 * Regression guard for the panel dark theme (`[data-theme="dark"]` in
 * globals.css). Keep these hex values in sync with that block; if a token
 * changes and a pair drops below its bar, this fails on purpose.
 */
const DARK = {
  canvas: "#14181a",
  surface: "#1c2123",
  ink: "#e9ebe9",
  muted: "#a7afac",
  faint: "#8b938f",
  brand50: "#123c30",
  brand600: "#0a815f",
  brand700: "#4cbe97",
  danger: "#f0857c",
  dangerBg: "#3a1c1a",
  success: "#56c48f",
  successBg: "#123021",
  warn: "#d8b45f",
  warnBg: "#322810",
  info: "#6fb0dd",
  infoBg: "#17303f",
};

function darker(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16);
  return (
    "#" +
    [((n >> 16) & 255) * (1 - t), ((n >> 8) & 255) * (1 - t), (n & 255) * (1 - t)]
      .map((v) => Math.round(v).toString(16).padStart(2, "0"))
      .join("")
  );
}

describe("dark theme contrast", () => {
  const D = DARK;
  const pairs: [string, string, string, number][] = [
    ["ink / surface", D.ink, D.surface, 7],
    ["ink / canvas", D.ink, D.canvas, 7],
    ["muted / surface", D.muted, D.surface, 4.5],
    ["faint / surface (eyebrow, large)", D.faint, D.surface, 3],
    ["danger pill text", D.danger, D.dangerBg, 4.5],
    ["success pill text", D.success, D.successBg, 4.5],
    ["warn pill text", D.warn, D.warnBg, 4.5],
    ["info pill text", D.info, D.infoBg, 4.5],
    ["white on primary button", "#ffffff", D.brand600, 4.5],
    ["white on primary button :hover", "#ffffff", darker(D.brand600, 0.12), 4.5],
    ["brand-700 text on brand-50 chip", D.brand700, D.brand50, 4.5],
    ["brand-700 text on surface", D.brand700, D.surface, 4.5],
  ];

  for (const [name, fg, bg, min] of pairs) {
    it(`${name} ≥ ${min}:1`, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
    });
  }
});
