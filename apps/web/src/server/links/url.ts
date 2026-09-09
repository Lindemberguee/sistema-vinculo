/** Build the public origin and full URL for a campaign's donation links. */

import { env } from "@/env";

// `env.APP_BASE_DOMAIN` is validated (min 3 chars, never blank); `optional()`
// already turns `PUBLIC_APP_BASE_DOMAIN=` in .env into `undefined`, so a bare
// `??` here is safe — no more `https://slug./path` when the var is left empty.
const PUBLIC_APP_BASE = env.PUBLIC_APP_BASE_DOMAIN ?? env.APP_BASE_DOMAIN;
const PUBLIC_SCHEME = PUBLIC_APP_BASE.includes("localhost") ? "http" : "https";

/** The bare public base host, e.g. `doacoes.com.br` or `localhost:3000`. */
export const publicAppBase = PUBLIC_APP_BASE;
/** `http` on localhost, `https` otherwise. */
export const publicScheme = PUBLIC_SCHEME;

/** Origin of the org panel (`app.<base>`), used for admin/email deep-links. */
export function appPanelOrigin(): string {
  const host =
    PUBLIC_APP_BASE.startsWith("app.") || PUBLIC_APP_BASE.includes("localhost")
      ? PUBLIC_APP_BASE
      : `app.${PUBLIC_APP_BASE}`;
  return `${host.includes("localhost") ? "http" : "https"}://${host}`;
}

/**
 * Where the org's public site lives: its verified custom domain when it has one,
 * otherwise `{slug}.{PUBLIC_APP_BASE_DOMAIN || APP_BASE_DOMAIN}`.
 */
export function orgPublicOrigin(opts: { slug: string; customHost?: string | null }): string {
  if (opts.customHost) return `https://${opts.customHost}`;
  return `${PUBLIC_SCHEME}://${opts.slug}.${PUBLIC_APP_BASE}`;
}

export function donationLinkUrl(origin: string, slug: string): string {
  return `${origin}/l/${slug}`;
}
