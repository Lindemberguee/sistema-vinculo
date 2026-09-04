/**
 * Block model for the e-mail template builder.
 *
 * A template body is an ordered list of `EmailBlock`s. `renderEmailBlocks` turns
 * them into table-based, inline-styled HTML that survives Outlook/Gmail. Blocks
 * carry `{TOKEN}` placeholders literally — they are filled later by
 * `renderTemplate` / `fillTokens` at send time.
 *
 * No zod here (the package has no such dep): `normalizeEmailBlocks` coerces
 * untrusted JSON field-by-field so a save can never throw on a stray value.
 */

import { BRAND, CALLOUT_BG, DIVIDER, INK_EMAIL as INK, MUTED_EMAIL as MUTED } from "@donation/tokens";

export type EmailBlockType =
  | "heading"
  | "text"
  | "button"
  | "image"
  | "divider"
  | "spacer"
  | "callout"
  | "donationDetails"
  | "footer"
  | "html";

export interface EmailBlock {
  id: string;
  type: EmailBlockType;
  props: Record<string, unknown>;
}

// ── coercion helpers ────────────────────────────────────────────────
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const clampStr = (v: unknown, max: number, fallback = ""): string => str(v, fallback).slice(0, max);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
const hex = (v: unknown, fallback: string): string =>
  typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim().toLowerCase() : fallback;
const int = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

const ALIGN = ["left", "center", "right"] as const;
type Align = (typeof ALIGN)[number];

const DETAIL_FIELDS = ["VALOR", "TOTAL", "METODO", "DATA", "CAMPANHA"] as const;
type DetailField = (typeof DETAIL_FIELDS)[number];
const DETAIL_LABEL: Record<DetailField, string> = {
  VALOR: "Valor da doação",
  TOTAL: "Total pago",
  METODO: "Forma de pagamento",
  DATA: "Data",
  CAMPANHA: "Campanha",
};

// ── HTML sanitisation (author is an org ADMIN, but multi-tenant → still filter) ──

function stripDangerous(s: string): string {
  return s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(script|style|iframe|object|embed|form|input|meta|link|base)\b[\s\S]*?(<\/\s*\1\s*>|$)/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')?\s*javascript:[^"'>\s]*/gi, '$1="#"');
}

const INLINE_TAGS = "b|strong|i|em|u|s|br|span|a";

/** For `text` / `callout`: keep light inline formatting and links only. */
export function sanitizeInline(input: unknown): string {
  let s = stripDangerous(str(input)).slice(0, 8000);
  // drop any tag that isn't an allowed inline tag (keep the inner text)
  s = s.replace(new RegExp(`<(?!\\/?(?:${INLINE_TAGS})\\b)[^>]*>`, "gi"), "");
  // on <a>, keep only a safe href
  s = s.replace(/<a\b[^>]*>/gi, (m) => {
    const h = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(m);
    const href = (h?.[2] ?? h?.[3] ?? "").trim();
    const ok = /^(https?:\/\/|mailto:|\/|\{[A-Z_]+\})/.test(href);
    return ok ? `<a href="${esc(href)}" style="color:${BRAND}">` : "<a>";
  });
  return s.trim();
}

const BLOCK_TAGS = `${INLINE_TAGS}|p|div|h1|h2|h3|h4|h5|h6|ul|ol|li|table|thead|tbody|tr|td|th|img|hr|blockquote`;

/** For the advanced `html` block: allow block tags + inline styles, still no scripts. */
export function sanitizeBlockHtml(input: unknown): string {
  let s = stripDangerous(str(input)).slice(0, 20_000);
  s = s.replace(new RegExp(`<(?!\\/?(?:${BLOCK_TAGS})\\b)[^>]*>`, "gi"), "");
  return s.trim();
}

export function esc(s: string): string {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

// ── block registry: label + defaults + coercion ─────────────────────

interface BlockDef {
  label: string;
  defaults: Record<string, unknown>;
  coerce: (raw: Record<string, unknown>) => Record<string, unknown>;
}

export const EMAIL_BLOCK_DEFS: Record<EmailBlockType, BlockDef> = {
  heading: {
    label: "Título",
    defaults: { text: "Título", level: "h1", align: "left", color: INK },
    coerce: (r) => ({
      text: clampStr(r.text, 200, "Título"),
      level: oneOf(r.level, ["h1", "h2", "h3"] as const, "h1"),
      align: oneOf<Align>(r.align, ALIGN, "left"),
      color: hex(r.color, INK),
    }),
  },
  text: {
    label: "Texto",
    defaults: {
      html: "Escreva aqui. Use <strong>negrito</strong>, <em>itálico</em> e variáveis como {NOME}.",
      align: "left",
      color: INK,
      size: "md",
    },
    coerce: (r) => ({
      html: sanitizeInline(r.html),
      align: oneOf<Align>(r.align, ALIGN, "left"),
      color: hex(r.color, INK),
      size: oneOf(r.size, ["sm", "md", "lg"] as const, "md"),
    }),
  },
  button: {
    label: "Botão",
    defaults: { label: "Ver mais", href: "{LINK}", bg: BRAND, color: "#ffffff", align: "left", radius: "full" },
    coerce: (r) => ({
      label: clampStr(r.label, 60, "Ver mais"),
      href: clampStr(r.href, 500, "{LINK}"),
      bg: hex(r.bg, BRAND),
      color: hex(r.color, "#ffffff"),
      align: oneOf<Align>(r.align, ALIGN, "left"),
      radius: oneOf(r.radius, ["full", "md", "none"] as const, "full"),
    }),
  },
  image: {
    label: "Imagem",
    defaults: { src: "", alt: "", href: "", width: 520, align: "center" },
    coerce: (r) => ({
      src: clampStr(r.src, 1000),
      alt: clampStr(r.alt, 200),
      href: clampStr(r.href, 500),
      width: int(r.width, 520, 40, 560),
      align: oneOf<Align>(r.align, ALIGN, "center"),
    }),
  },
  divider: {
    label: "Divisória",
    defaults: { color: DIVIDER, gap: 16 },
    coerce: (r) => ({ color: hex(r.color, DIVIDER), gap: int(r.gap, 16, 0, 48) }),
  },
  spacer: {
    label: "Espaço",
    defaults: { height: 24 },
    coerce: (r) => ({ height: int(r.height, 24, 4, 96) }),
  },
  callout: {
    label: "Caixa de destaque",
    defaults: { html: "Informação em destaque — ex.: Total pago: {TOTAL}", bg: CALLOUT_BG, color: INK, align: "left" },
    coerce: (r) => ({
      html: sanitizeInline(r.html),
      bg: hex(r.bg, CALLOUT_BG),
      color: hex(r.color, INK),
      align: oneOf<Align>(r.align, ALIGN, "left"),
    }),
  },
  donationDetails: {
    label: "Detalhes da doação",
    defaults: { fields: ["VALOR", "TOTAL", "METODO", "DATA"] },
    coerce: (r) => {
      const raw = Array.isArray(r.fields) ? r.fields : [];
      const fields = DETAIL_FIELDS.filter((f) => raw.includes(f));
      return { fields: fields.length ? fields : ["VALOR", "TOTAL", "METODO", "DATA"] };
    },
  },
  footer: {
    label: "Rodapé",
    defaults: { text: "Você recebe este e-mail porque doou para {ORGANIZACAO}.", color: MUTED },
    coerce: (r) => ({ text: clampStr(r.text, 400, ""), color: hex(r.color, MUTED) }),
  },
  html: {
    label: "HTML avançado",
    defaults: { html: "<p>HTML personalizado</p>" },
    coerce: (r) => ({ html: sanitizeBlockHtml(r.html) }),
  },
};

export const EMAIL_BLOCK_TYPES = Object.keys(EMAIL_BLOCK_DEFS) as EmailBlockType[];

function rid(type: EmailBlockType): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${type}-${rnd}`;
}

export function newEmailBlock(type: EmailBlockType): EmailBlock {
  const def = EMAIL_BLOCK_DEFS[type];
  return { id: rid(type), type, props: { ...def.defaults } };
}

/** Coerce untrusted JSON (from the builder or the DB) into a safe block list. */
export function normalizeEmailBlocks(raw: unknown): EmailBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: EmailBlock[] = [];
  const seen = new Set<string>();
  for (const item of raw.slice(0, 80)) {
    if (!item || typeof item !== "object") continue;
    const type = (item as { type?: unknown }).type;
    if (typeof type !== "string" || !(type in EMAIL_BLOCK_DEFS)) continue;
    const t = type as EmailBlockType;
    let id = str((item as { id?: unknown }).id).slice(0, 40) || rid(t);
    while (seen.has(id)) id = rid(t);
    seen.add(id);
    const props = (item as { props?: unknown }).props;
    out.push({ id, type: t, props: EMAIL_BLOCK_DEFS[t].coerce((props as Record<string, unknown>) ?? {}) });
  }
  return out;
}

// ── rendering ──────────────────────────────────────────────────────

const SIZE_PX: Record<string, number> = { sm: 13, md: 15, lg: 17 };
const HEADING_PX: Record<string, number> = { h1: 24, h2: 19, h3: 16 };
const RADIUS_PX: Record<string, number> = { full: 999, md: 8, none: 0 };

function row(inner: string, pad: string): string {
  return `<tr><td style="padding:${pad}">${inner}</td></tr>`;
}

function renderBlock(b: EmailBlock): string {
  const p = b.props;
  switch (b.type) {
    case "heading": {
      const size = HEADING_PX[str(p.level, "h1")] ?? 24;
      return row(
        `<h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:${size}px;line-height:1.3;font-weight:bold;color:${str(p.color, INK)};text-align:${str(p.align, "left")}">${esc(str(p.text))}</h1>`,
        "0 0 14px",
      );
    }
    case "text": {
      const size = SIZE_PX[str(p.size, "md")] ?? 15;
      return row(
        `<div style="font-family:Arial,Helvetica,sans-serif;font-size:${size}px;line-height:1.65;color:${str(p.color, INK)};text-align:${str(p.align, "left")}">${sanitizeInline(p.html)}</div>`,
        "0 0 14px",
      );
    }
    case "button": {
      const r = RADIUS_PX[str(p.radius, "full")] ?? 999;
      const align = str(p.align, "left");
      const a = `<a href="${esc(str(p.href, "{LINK}"))}" style="display:inline-block;padding:12px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;line-height:1;color:${str(p.color, "#ffffff")};text-decoration:none;border-radius:${r}px">${esc(str(p.label, "Ver mais"))}</a>`;
      const table = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr><td style="border-radius:${r}px;background:${str(p.bg, BRAND)}">${a}</td></tr></table>`;
      return row(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="${align}">${table}</td></tr></table>`,
        "6px 0 18px",
      );
    }
    case "image": {
      const src = str(p.src);
      if (!src) return "";
      const align = str(p.align, "center");
      const img = `<img src="${esc(src)}" alt="${esc(str(p.alt))}" width="${int(p.width, 520, 40, 560)}" style="display:block;border:0;outline:none;max-width:100%;height:auto;margin:${align === "center" ? "0 auto" : "0"}">`;
      const href = str(p.href);
      const wrapped = href ? `<a href="${esc(href)}" target="_blank">${img}</a>` : img;
      return row(`<div style="text-align:${align}">${wrapped}</div>`, "0 0 14px");
    }
    case "divider":
      return row(
        `<div style="border-top:1px solid ${str(p.color, DIVIDER)};font-size:0;line-height:0">&nbsp;</div>`,
        `${int(p.gap, 16, 0, 48)}px 0`,
      );
    case "spacer": {
      const h = int(p.height, 24, 4, 96);
      return `<tr><td style="height:${h}px;line-height:${h}px;font-size:0">&nbsp;</td></tr>`;
    }
    case "callout":
      return row(
        `<div style="background:${str(p.bg, CALLOUT_BG)};color:${str(p.color, INK)};border-radius:10px;padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;text-align:${str(p.align, "left")}">${sanitizeInline(p.html)}</div>`,
        "0 0 14px",
      );
    case "donationDetails": {
      const fields = (Array.isArray(p.fields) ? p.fields : []).filter((f): f is DetailField =>
        (DETAIL_FIELDS as readonly string[]).includes(f as string),
      );
      if (fields.length === 0) return "";
      const rows = fields
        .map(
          (f) =>
            `<tr><td style="padding:6px 0;color:${MUTED};font-family:Arial,Helvetica,sans-serif;font-size:14px">${DETAIL_LABEL[f]}</td><td style="padding:6px 0;text-align:right;color:${INK};font-family:Arial,Helvetica,sans-serif;font-size:14px">{${f}}</td></tr>`,
        )
        .join("");
      return row(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">${rows}</table>`,
        "2px 0 16px",
      );
    }
    case "footer": {
      const text = str(p.text);
      if (!text) return "";
      return row(
        `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${str(p.color, MUTED)};text-align:center">${esc(text)}</p>`,
        "18px 0 0",
      );
    }
    case "html":
      return row(`<div>${sanitizeBlockHtml(p.html)}</div>`, "0 0 14px");
    default:
      return "";
  }
}

/** Ordered blocks → inner HTML for a template body (goes inside the shared shell). */
export function renderEmailBlocks(blocks: EmailBlock[]): string {
  const body = blocks.map(renderBlock).filter(Boolean).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">${body}</table>`;
}
