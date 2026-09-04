import { randomInt } from "node:crypto";

const SUFFIX_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

/**
 * Turn a person's name into a URL-safe slug base: lowercase ASCII, accents
 * stripped, non-alphanumerics collapsed to single hyphens, trimmed. Falls back
 * to "apoiador" when nothing usable is left.
 */
export function slugifyName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 40)
    .replace(/-+$/, "");
  return base || "apoiador";
}

/** A short random suffix appended on slug collision, e.g. "maria-2k7p". */
export function randomSuffix(len = 4): string {
  let out = "";
  for (let i = 0; i < len; i += 1) out += SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)];
  return out;
}

/** Cheap gate before a DB lookup — matches slugifyName output plus optional suffix. */
export function isAmbassadorSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length >= 2 && value.length <= 60;
}
