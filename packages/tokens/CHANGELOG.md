# @donation/tokens

Cross-surface design tokens that live outside CSS (e-mail renderers + worker).

## 0.1.0

- Initial release. Exports: `BRAND`, `INK_EMAIL`, `MUTED_EMAIL`, `FAINT_EMAIL`,
  `CANVAS`, `CARD_BORDER`, `CALLOUT_BG`, `DIVIDER`, `FONT_STACK_EMAIL`.
- `packages/emails` (`email-blocks.ts`, `templates.ts`, `index.ts`) now import
  these instead of local hex literals.
- `CANVAS` (`#f8f8f6`) replaces the e-mail shell's old `#f4f4f5` so app and
  e-mail share one off-white.

## Contract

- **Value change** → minor version, note the before/after here.
- **Rename / remove** → major, keep the old name as a `@deprecated` alias for one
  cycle first.
- Any change is reviewed against the `/style-guide` route (Fase 4) before merge.
