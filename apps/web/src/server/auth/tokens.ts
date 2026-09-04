import { randomBytes } from "node:crypto";

/**
 * Helpers for the single-use tokens behind e-mail verification and password
 * reset. Both live in the Auth.js `VerificationToken` table, namespaced by the
 * `identifier` column so the two flows never collide.
 */

export type TokenKind = "verify" | "pwreset";

const TTL_MS: Record<TokenKind, number> = {
  verify: 24 * 60 * 60 * 1000, // 24h
  pwreset: 60 * 60 * 1000, //  1h
};

/** `verify:alice@example.com` — the `VerificationToken.identifier` value. */
export function identifierFor(kind: TokenKind, email: string): string {
  return `${kind}:${email.toLowerCase().trim()}`;
}

/** Parse an identifier back into its parts; null if it isn't one of ours. */
export function parseIdentifier(identifier: string): { kind: TokenKind; email: string } | null {
  const i = identifier.indexOf(":");
  if (i < 0) return null;
  const kind = identifier.slice(0, i);
  if (kind !== "verify" && kind !== "pwreset") return null;
  return { kind, email: identifier.slice(i + 1) };
}

export function newToken(): string {
  return randomBytes(32).toString("hex");
}

export function expiryFor(kind: TokenKind, now: Date = new Date()): Date {
  return new Date(now.getTime() + TTL_MS[kind]);
}

export function isExpired(expires: Date, now: Date = new Date()): boolean {
  return expires.getTime() <= now.getTime();
}
