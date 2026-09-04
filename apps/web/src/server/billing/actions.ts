"use server";

import { prisma } from "@donation/db";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";

export interface BillingResult {
  ok: boolean;
  error?: string;
}

/**
 * Plan changes are intentionally not self-service until the monthly license
 * billing flow exists. This prevents an owner from unlocking paid entitlements
 * without a confirmed license payment (AUD-005).
 */
export async function changePlan(organizationId: string, planId: string): Promise<BillingResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "OWNER");

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { id: true, name: true, isPublic: true },
    });
    if (!plan || !plan.isPublic) return { ok: false, error: "Plano indisponível" };

    const org = await db.organization.findFirst({ where: { id: organizationId }, select: { planId: true } });
    if (!org) return { ok: false, error: "Organização não encontrada" };
    if (org.planId === planId) return { ok: true };

    return {
      ok: false,
      error: `A troca para o plano ${plan.name} será feita pela equipe após a confirmação da mensalidade.`,
    };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}
