/**
 * Pure helpers for turning a DonationLink row into the checkout configuration
 * the public page applies. No DB / framework imports so this stays unit-tested.
 */

export type DonationLinkStatusLike = "ACTIVE" | "PAUSED" | "ARCHIVED";

export interface DonationLinkLike {
  status: DonationLinkStatusLike;
  expiresAt: Date | null;
  amountCents: number | null;
  suggestedAmountsCents: number[];
  lockAmount: boolean;
  defaultRecurring: boolean;
  defaultCoverFee: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
}

export interface CampaignAmountConfig {
  minAmountCents: number;
  suggestedAmountsCents: number[];
}

export interface LinkPreset {
  /** Fixed starting amount, already clamped to the campaign minimum. */
  amountCents: number | null;
  /** Amount cannot be changed by the donor. Only true when an amount is set. */
  lockAmount: boolean;
  suggestedAmountsCents: number[];
  defaultRecurring: boolean;
  defaultCoverFee: boolean;
  /** utm_* pairs to fold into Donation.metadata. Empty keys are dropped. */
  utm: Record<string, string>;
}

/** ACTIVE and not past its expiry. */
export function linkIsLive(link: Pick<DonationLinkLike, "status" | "expiresAt">, now: Date = new Date()): boolean {
  if (link.status !== "ACTIVE") return false;
  if (link.expiresAt && link.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

export function linkUtm(link: DonationLinkLike): Record<string, string> {
  const utm: Record<string, string> = {};
  if (link.utmSource) utm.utmSource = link.utmSource;
  if (link.utmMedium) utm.utmMedium = link.utmMedium;
  if (link.utmCampaign) utm.utmCampaign = link.utmCampaign;
  if (link.utmContent) utm.utmContent = link.utmContent;
  if (link.utmTerm) utm.utmTerm = link.utmTerm;
  return utm;
}

export function linkToPreset(link: DonationLinkLike, campaign: CampaignAmountConfig): LinkPreset {
  let amountCents: number | null = null;
  if (link.amountCents != null && link.amountCents > 0) {
    amountCents = Math.max(link.amountCents, campaign.minAmountCents);
  }
  const suggested =
    link.suggestedAmountsCents.length > 0 ? link.suggestedAmountsCents : campaign.suggestedAmountsCents;

  return {
    amountCents,
    // A lock without an amount is meaningless — ignore it.
    lockAmount: link.lockAmount && amountCents != null,
    suggestedAmountsCents: suggested,
    defaultRecurring: link.defaultRecurring,
    defaultCoverFee: link.defaultCoverFee,
    utm: linkUtm(link),
  };
}
