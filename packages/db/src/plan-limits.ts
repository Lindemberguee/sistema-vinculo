import { prisma } from "./index";

/**
 * Optional product modules gated by plan. "donation" (the core: pages + one-off
 * + recurring checkout) is always available and is NOT in this list.
 */
export const MODULES = [
  "crm",
  "raffles",
  "events",
  "auctions",
  "sponsees",
  "links",
  "ambassadors",
  "intl",
] as const;
export type ModuleKey = (typeof MODULES)[number];

export interface PlanLimits {
  maxCampaigns: number | null; // null = unlimited
  maxUsers: number | null;
  customDomain: boolean;
  removeBranding: boolean;
  modules: string[]; // ["*"] = every module
}

const FREE_DEFAULTS: PlanLimits = {
  maxCampaigns: 1,
  maxUsers: 2,
  customDomain: false,
  removeBranding: false,
  modules: [],
};

const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null;

/** Coerce a `Plan.limits` JSON blob into a safe shape (missing keys → free tier). */
export function parsePlanLimits(raw: unknown): PlanLimits {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    maxCampaigns: "maxCampaigns" in o ? numOrNull(o.maxCampaigns) : FREE_DEFAULTS.maxCampaigns,
    maxUsers: "maxUsers" in o ? numOrNull(o.maxUsers) : FREE_DEFAULTS.maxUsers,
    customDomain: Boolean(o.customDomain),
    removeBranding: Boolean(o.removeBranding),
    modules: Array.isArray(o.modules) ? o.modules.filter((m): m is string => typeof m === "string") : [],
  };
}

export function planHasModule(limits: PlanLimits, m: ModuleKey): boolean {
  return limits.modules.includes("*") || limits.modules.includes(m);
}

export function moduleAccessFor(limits: PlanLimits): Record<ModuleKey, boolean> {
  return Object.fromEntries(MODULES.map((m) => [m, planHasModule(limits, m)])) as Record<ModuleKey, boolean>;
}

/** Load the org's effective plan limits. */
export async function getOrgLimits(organizationId: string): Promise<PlanLimits> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: { select: { limits: true } } },
  });
  return parsePlanLimits(org?.plan?.limits ?? {});
}
