/** Build the public origin and full URL for a campaign's donation links. */

const APP_BASE = process.env.APP_BASE_DOMAIN ?? "localhost:3000";
const SCHEME = APP_BASE.includes("localhost") ? "http" : "https";

/**
 * Where the org's public site lives: its verified custom domain when it has one,
 * otherwise `{slug}.{APP_BASE_DOMAIN}`.
 */
export function orgPublicOrigin(opts: { slug: string; customHost?: string | null }): string {
  if (opts.customHost) return `https://${opts.customHost}`;
  return `${SCHEME}://${opts.slug}.${APP_BASE}`;
}

export function donationLinkUrl(origin: string, slug: string): string {
  return `${origin}/l/${slug}`;
}
