"use server";

import { revalidatePath } from "next/cache";
import { prisma, withOrgContext, parsePlanLimits } from "@donation/db";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";

export interface BillingResult {
  ok: boolean;
  error?: string;
}

/**
 * Switch the org's plan. Real charging of the monthly fee (Pagar.me subscription)
 * lands in Phase 5; for now this updates the plan used for fee calculation and
 * feature limits immediately.
 */
export async function changePlan(organizationId: string, planId: string): Promise<BillingResult> {
  try {
    const { db, userId } = await requireOrgAccess(organizationId, "OWNER");

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { id: true, isPublic: true, limits: true },
    });
    if (!plan || !plan.isPublic) return { ok: false, error: "Plano indisponível" };

    const org = await db.organization.findFirst({ where: { id: organizationId }, select: { planId: true } });
    if (!org) return { ok: false, error: "Organização não encontrada" };
    if (org.planId === planId) return { ok: true };

    // Block a downgrade that would leave the org over the new user limit.
    const newLimits = parsePlanLimits(plan.limits);
    if (newLimits.maxUsers != null) {
      const members = await db.membership.count({ where: { organizationId } });
      if (members > newLimits.maxUsers) {
        return {
          ok: false,
          error: `Você tem ${members} usuários; o plano ${plan.id} permite ${newLimits.maxUsers}. Remova alguém antes de trocar.`,
        };
      }
    }

    await withOrgContext(organizationId, (tx) =>
      Promise.all([
        tx.organization.update({ where: { id: organizationId }, data: { planId } }),
        // updateMany no-ops if the org has no subscription row yet (legacy orgs).
        tx.subscription.updateMany({ where: { organizationId }, data: { planId } }),
        tx.auditLog.create({
          data: {
            organizationId,
            userId,
            action: "plan.changed",
            entity: "Organization",
            entityId: organizationId,
            diff: { planId: [org.planId, planId] },
          },
        }),
      ]),
    );
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/billing`);
  revalidatePath(`/panel/orgs/${organizationId}/settings`);
  return { ok: true };
}
