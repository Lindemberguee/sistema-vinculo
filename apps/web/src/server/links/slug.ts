import { randomInt } from "node:crypto";

/**
 * Alphabet for public link slugs: lowercase letters + digits, with the visually
 * ambiguous characters removed (0/o, 1/l/i). Safe to read aloud and to type
 * from a printed QR fallback.
 */
export const LINK_SLUG_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

/** A random `/l/{slug}` code. Collisions are handled by a retry loop at the call site. */
export function randomLinkSlug(length = 7): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += LINK_SLUG_ALPHABET[randomInt(LINK_SLUG_ALPHABET.length)];
  }
  return out;
}

/** Whether a string could be one of our slugs (used to reject junk fast). */
export function isLinkSlug(value: string): boolean {
  return value.length >= 3 && value.length <= 16 && [...value].every((c) => LINK_SLUG_ALPHABET.includes(c));
}
