import "server-only";
import { ForbiddenError } from "@donation/shared";
import { getOrgLimits, planHasModule, type ModuleKey } from "@donation/db";
import type { requireOrgAccess } from "@/server/auth-helpers";

type Db = Awaited<ReturnType<typeof requireOrgAccess>>["db"];

/** Throw if the org's plan does not include `module`. Call after requireOrgAccess. */
export async function assertModule(organizationId: string, module: ModuleKey): Promise<void> {
  const limits = await getOrgLimits(organizationId);
  if (!planHasModule(limits, module)) {
    throw new ForbiddenError("Seu plano não inclui este recurso. Faça upgrade em Plano e cobrança.");
  }
}

/** Throw if creating another campaign would exceed the plan's maxCampaigns. */
export async function assertCampaignQuota(db: Db, organizationId: string): Promise<void> {
  const limits = await getOrgLimits(organizationId);
  if (limits.maxCampaigns == null) return;
  const count = await db.campaign.count({ where: { organizationId } });
  if (count >= limits.maxCampaigns) {
    throw new ForbiddenError(
      `Seu plano permite ${limits.maxCampaigns} campanha${limits.maxCampaigns === 1 ? "" : "s"}. Faça upgrade para criar mais.`,
    );
  }
}

/** Throw if inviting another member would exceed the plan's maxUsers (members + pending invites). */
export async function assertUserQuota(db: Db, organizationId: string): Promise<void> {
  const limits = await getOrgLimits(organizationId);
  if (limits.maxUsers == null) return;
  const [members, invites] = await Promise.all([
    db.membership.count({ where: { organizationId } }),
    db.invitation.count({ where: { organizationId, acceptedAt: null } }),
  ]);
  if (members + invites >= limits.maxUsers) {
    throw new ForbiddenError(
      `Seu plano permite ${limits.maxUsers} usuários. Remova alguém ou faça upgrade.`,
    );
  }
}
