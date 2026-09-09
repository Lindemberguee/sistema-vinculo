// Treat a blank env value (`APP_BASE_DOMAIN=` in .env) as unset — otherwise
// `??` keeps the "" and builds broken `https://slug./path` URLs.
const clean = (v: string | undefined) => {
  const t = v?.trim();
  return t ? t : undefined;
};
const APP_BASE = clean(process.env.APP_BASE_DOMAIN) ?? "localhost:3000";
const PUBLIC_APP_BASE = clean(process.env.PUBLIC_APP_BASE_DOMAIN) ?? APP_BASE;

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