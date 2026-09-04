import { assertCents, type Cents } from "@donation/shared";

/** Legacy fee configuration. Production donations use BYOG_FEE_CONFIG. */
export interface FeeConfig {
  /** Legacy platform fee in basis points. 490 => 4.90%. */
  platformFeeBps: number;
  /** Legacy flat platform fee added on top, in cents. */
  platformFeeFixedCents: Cents;
}

/**
 * BYOG/CONNECTED pricing: the platform charges no percentage or fixed fee on
 * donations. The gateway may still charge its own processing fee directly to
 * the organization's account.
 */
export const BYOG_FEE_CONFIG: FeeConfig = Object.freeze({ platformFeeBps: 0, platformFeeFixedCents: 0 });

export interface FeeInput {
  /** Gross donation amount (what the donor intends the org to receive). */
  amountCents: Cents;
  /** Optional contribution added to the donation total. */
  tipCents?: Cents;
  config: FeeConfig;
}

export interface FeeBreakdown {
  amountCents: Cents;
  tipCents: Cents;
  /** Total the donor is charged: amount + tip. */
  chargeTotalCents: Cents;
  /** Legacy platform fee. Always zero with `BYOG_FEE_CONFIG`. */
  grossPlatformFeeCents: Cents;
  /** Legacy platform split leg; zero for BYOG. */
  platformFeeCents: Cents;
  /** Legacy display field for fee absorbed by the organization. */
  orgFeeBorneCents: Cents;
  /** Amount routed to the organization's gateway account. */
  netToOrgCents: Cents;
}

/**
 * Pure fee/split calculation. This is the single source of truth for money math;
 * never recompute fees ad hoc elsewhere, and never trust a fee value from the client.
 *
 * Model:
 *   chargeTotal   = amount + tip
 *   platformFee   = ceil(amount * bps / 10_000) + fixed   // legacy only
 *   netToOrg      = chargeTotal - platformFee              // = amount + tip - platformFee
 *   orgFeeBorne   = max(0, platformFee - tip)              // what the fee cost the org (display)
 *
 * In BYOG, `bps` and `fixed` are zero, so the organization's account receives
 * the full charge total (less only fees charged by its own gateway).
 */
export function calculateFees({ amountCents, tipCents = 0, config }: FeeInput): FeeBreakdown {
  assertCents(amountCents, "amountCents");
  assertCents(tipCents, "tipCents");

  if (amountCents <= 0) {
    throw new RangeError("amountCents must be greater than zero");
  }
  if (!Number.isInteger(config.platformFeeBps) || config.platformFeeBps < 0 || config.platformFeeBps > 10_000) {
    throw new RangeError(`platformFeeBps out of range: ${config.platformFeeBps}`);
  }
  assertCents(config.platformFeeFixedCents, "platformFeeFixedCents");

  const chargeTotalCents = amountCents + tipCents;

  const platformFeeCents =
    Math.ceil((amountCents * config.platformFeeBps) / 10_000) + config.platformFeeFixedCents;

  const netToOrgCents = chargeTotalCents - platformFeeCents;
  const orgFeeBorneCents = Math.max(0, platformFeeCents - tipCents);

  // Invariants — cheap to check, catastrophic to get wrong.
  if (netToOrgCents <= 0) {
    throw new RangeError(
      `Donation too small for fee: net to org would be ${netToOrgCents} cents (charge ${chargeTotalCents}, fee ${platformFeeCents})`,
    );
  }
  if (netToOrgCents + platformFeeCents !== chargeTotalCents) {
    throw new Error("Fee split does not reconcile with charge total");
  }

  return {
    amountCents,
    tipCents,
    chargeTotalCents,
    grossPlatformFeeCents: platformFeeCents,
    platformFeeCents,
    orgFeeBorneCents,
    netToOrgCents,
  };
}

/** Build the legacy managed Pagar.me `split` array. BYOG flows always send `[]`. */
export function buildSplit(params: {
  breakdown: FeeBreakdown;
  orgRecipientId: string;
  platformRecipientId: string;
}) {
  const { breakdown, orgRecipientId, platformRecipientId } = params;
  return [
    {
      recipient_id: orgRecipientId,
      amount: breakdown.netToOrgCents,
      type: "flat" as const,
      options: { liable: true, charge_processing_fee: false, charge_remainder_fee: false },
    },
    {
      recipient_id: platformRecipientId,
      amount: breakdown.platformFeeCents,
      type: "flat" as const,
      // Platform absorbs the gateway processing fee so the org gets a predictable net.
      options: { liable: true, charge_processing_fee: true, charge_remainder_fee: true },
    },
  ];
}
