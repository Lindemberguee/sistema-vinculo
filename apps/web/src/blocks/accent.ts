/**
 * Tenant accent colour → a small derived palette with a real WCAG contrast
 * guard rail. Pure and isomorphic (no imports) — used by `render-static.tsx`
 * (public pages + Studio canvas) and `ThemePanel.tsx` (the theme preview).
 *
 * Rule: **fills** use the accent as-is; only **text/icons on white** use
 * `textInk` (a darkened accent that clears 4.5:1 on white).
 */

export const DEFAULT_ACCENT = "#006B4F"; // brand-600
const INK = "#17201c";

const HEX = /^#?([0-9a-f]{6})$/i;

function parse(hex: string): [number, number, number] | null {
  const m = HEX.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = ([r, g, b]: [number, number, number]) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

/** WCAG relative luminance (0–1). */
function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours (1–21). */
export function contrast(a: string, b: string): number {
  const ra = parse(a);
  const rb = parse(b);
  if (!ra || !rb) return 1;
  const la = luminance(ra);
  const lb = luminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export interface AccentPalette {
  /** Sanitised accent (falls back to the brand green). Use for FILLS. */
  accent: string;
  /** Readable text on top of a solid `accent` fill — white or ink. */
  onAccent: string;
  /** Accent darkened until it clears 4.5:1 on white — use for TEXT/ICONS on white. */
  textInk: string;
  /** Very light accent tint — banner / chip backgrounds. */
  wash: string;
  /** Light accent tint — hover of a washed surface. */
  soft: string;
  /** Accent nudged darker — hover of a solid button. */
  hover: string;
  /** Accent at 50% alpha — focus ring on tenant controls. */
  ring: string;
  /** True when the raw accent failed 4.5:1 on white (Studio shows a note). */
  lowContrastOnWhite: boolean;
}

/** Derive the full accent palette from one hex (or the default on bad input). */
export function resolveAccent(input: string | undefined | null): AccentPalette {
  const rgb = parse(input ?? "") ?? parse(DEFAULT_ACCENT)!;
  const accent = toHex(rgb);
  const white: [number, number, number] = [255, 255, 255];
  const black: [number, number, number] = [0, 0, 0];

  const onAccent = contrast("#ffffff", accent) >= contrast(INK, accent) ? "#ffffff" : INK;

  const lowContrastOnWhite = contrast(accent, "#ffffff") < 4.5;
  let textInk = accent;
  for (let i = 0; i < 8 && contrast(textInk, "#ffffff") < 4.5; i++) {
    textInk = toHex(mix(parse(textInk)!, black, 0.12));
  }

  return {
    accent,
    onAccent,
    textInk,
    wash: toHex(mix(rgb, white, 0.92)),
    soft: toHex(mix(rgb, white, 0.86)),
    hover: toHex(mix(rgb, black, 0.08)),
    ring: `${accent}80`,
    lowContrastOnWhite,
  };
}
