import { assertCents, type Cents } from "@donation/shared";

/** Fee configuration, taken from the org's Plan row. */
export interface FeeConfig {
  /** Platform fee in basis points. 490 => 4.90%. */
  platformFeeBps: number;
  /** Flat platform fee added on top, in cents. */
  platformFeeFixedCents: Cents;
}

export interface FeeInput {
  /** Gross donation amount (what the donor intends the org to receive). */
  amountCents: Cents;
  /** Optional "cover the fee" tip. Applied against the platform fee first. */
  tipCents?: Cents;
  config: FeeConfig;
}

export interface FeeBreakdown {
  amountCents: Cents;
  tipCents: Cents;
  /** Total the donor is charged: amount + tip. */
  chargeTotalCents: Cents;
  /** The platform fee. Equal to `platformFeeCents` — kept for readability. */
  grossPlatformFeeCents: Cents;
  /** Platform's split leg — the platform always keeps its fee. */
  platformFeeCents: Cents;
  /** How much of the fee the org actually absorbed (0 once the tip covers it). Display only. */
  orgFeeBorneCents: Cents;
  /** Amount routed to the org's recipient in the split. */
  netToOrgCents: Cents;
}

/**
 * Pure fee/split calculation. This is the single source of truth for money math;
 * never recompute fees ad hoc elsewhere, and never trust a fee value from the client.
 *
 * Model:
 *   chargeTotal   = amount + tip
 *   platformFee   = ceil(amount * bps / 10_000) + fixed   // platform ALWAYS keeps this
 *   netToOrg      = chargeTotal - platformFee              // = amount + tip - platformFee
 *   orgFeeBorne   = max(0, platformFee - tip)              // what the fee cost the org (display)
 *
 * A "cover the fee" tip funds the platform fee so the donation reaches the org
 * at 100% — it does NOT waive the platform's revenue. The two split legs
 * (netToOrg, platformFee) always sum to chargeTotal.
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

/** Build the Pagar.me `split` array from a breakdown. */
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
