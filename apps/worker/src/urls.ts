const APP_BASE = process.env.APP_BASE_DOMAIN ?? "localhost:3000";
const PUBLIC_APP_BASE = process.env.PUBLIC_APP_BASE_DOMAIN ?? APP_BASE;

export const publicAppBase = PUBLIC_APP_BASE;
export const publicScheme = PUBLIC_APP_BASE.includes("localhost") ? "http" : "https";

export function appOrigin(): string {
  return PUBLIC_APP_BASE.startsWith("app.")
    ? `${publicScheme}://${PUBLIC_APP_BASE}`
    : `${publicScheme}://app.${PUBLIC_APP_BASE}`;
}

export function orgOrigin(slug: string): string {
  return `${publicScheme}://${slug}.${PUBLIC_APP_BASE}`;
}