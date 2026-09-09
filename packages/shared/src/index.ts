export * from "./money";
export * from "./errors";
export * from "./rfm";
// NOTE: ./ssrf is intentionally NOT re-exported here — it pulls in node:net /
// node:dns and this barrel is imported by client components and the edge
// middleware. Import it directly: `@donation/shared/ssrf`.

/**
 * Free trial length for a new organization. The subscription starts as
 * `TRIALING` with `currentPeriodEnd = createdAt + this`; the billing sweep
 * turns it `PAST_DUE` after it lapses, then suspends after the grace period.
 */
export const TRIAL_PERIOD_DAYS = 30;

/** Roles a user can hold within an organization (highest to lowest privilege). */
export const ORG_ROLES = ["OWNER", "ADMIN", "FINANCE", "EDITOR", "VIEWER"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

const ROLE_RANK: Record<OrgRole, number> = {
  OWNER: 5,
  ADMIN: 4,
  FINANCE: 3,
  EDITOR: 2,
  VIEWER: 1,
};

/** True when `role` is at least as privileged as `required`. */
export function roleAllows(role: OrgRole, required: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

/** Event names an org can subscribe an outbound webhook to. */
export const WEBHOOK_EVENTS = [
  "donation.paid",
  "donation.refunded",
  "recurring.charged",
  "recurring.canceled",
  "campaign.published",
  "kyc.approved",
] as const;
export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number];

/** Advance a date by one recurring interval. */
export function addInterval(from: Date, interval: "MONTHLY" | "YEARLY"): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setDate(1); // avoid Jan 31 → Mar when the target month is shorter
  if (interval === "YEARLY") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}
