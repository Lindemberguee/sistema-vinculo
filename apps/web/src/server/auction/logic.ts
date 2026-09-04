/** Pure auction helpers. */

/** Minimum acceptable next bid for a lot. */
export function minNextBidCents(
  currentBidCents: number | null | undefined,
  startPriceCents: number,
  minIncrementCents: number,
): number {
  if (currentBidCents == null) return startPriceCents;
  return currentBidCents + minIncrementCents;
}

/** Validate a bid amount against the minimum. */
export function validateBid(
  amountCents: number,
  minCents: number,
): { ok: true } | { ok: false; reason: string } {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { ok: false, reason: "Valor inválido" };
  if (amountCents < minCents) return { ok: false, reason: `O lance mínimo agora é ${minCents} centavos` };
  return { ok: true };
}

/**
 * Anti-snipe: if a bid lands within `antiSnipeSeconds` of `endsAt`, the auction
 * end is pushed to `now + antiSnipeSeconds`. Returns the new end, or null if no
 * extension is needed.
 */
export function extendedEndsAt(
  endsAt: Date,
  now: Date,
  antiSnipeSeconds: number,
): Date | null {
  const windowMs = antiSnipeSeconds * 1000;
  if (endsAt.getTime() - now.getTime() > windowMs) return null;
  return new Date(now.getTime() + windowMs);
}

export function lotHasEnded(endsAt: Date, now: Date): boolean {
  return now.getTime() >= endsAt.getTime();
}
