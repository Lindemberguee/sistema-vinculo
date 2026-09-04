/**
 * Cross-surface design tokens that live *outside* CSS — the values the e-mail
 * renderers (and their worker consumers, via `@donation/emails`) need as plain
 * strings. Tailwind still reads the panel/site tokens from
 * `apps/web/src/app/globals.css`; the two must be kept in agreement (a few
 * values are duplicated on purpose and flagged below).
 *
 * Versioned with semver — see CHANGELOG.md. A value change is a minor; removing
 * or renaming a token is a major and needs a deprecation cycle.
 */

/** Institutional green. Buttons + links across every surface. Mirrors `--color-brand-600`. */
export const BRAND = "#006b4f";

/** Body text in e-mail (Arial on off-white). Darker than the panel `ink` for print-like legibility. */
export const INK_EMAIL = "#2f3b37";

/** Muted / secondary text in e-mail. */
export const MUTED_EMAIL = "#8a938f";

/** Faint footer / fine-print text in e-mail. */
export const FAINT_EMAIL = "#9ca3af";

/** Off-white page background. Same value as the panel/site `--color-canvas`. */
export const CANVAS = "#f8f8f6";

/** 1px card border in e-mail (the shell has no shadow). */
export const CARD_BORDER = "#e5e7eb";

/** Pale green tint behind callout boxes in the e-mail block builder. */
export const CALLOUT_BG = "#f2f7f4";

/** Warm hairline for the `divider` e-mail block. */
export const DIVIDER = "#e7e2d6";

/** Web-safe font stack for e-mail (no webfonts — clients strip them). */
export const FONT_STACK_EMAIL = "Arial,Helvetica,sans-serif";
