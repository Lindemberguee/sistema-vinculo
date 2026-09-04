"use server";

import { revalidatePath } from "next/cache";
import { prisma, releaseSponseeForPlan, resolveOrgGateway } from "@donation/db";
import { isAppError, PaymentError } from "@donation/shared";
import { recurringCanceledEmail, sendEmail } from "@donation/emails";
import { requireOrgAccess } from "@/server/auth-helpers";
import { emitOutboundEvent } from "@/server/webhooks/emit";

export interface RecurringResult {
  ok: boolean;
  error?: string;
}

async function cancelPlan(planId: string, reason: "requested" | "failed"): Promise<void> {
  const plan = await prisma.recurringPlan.findUnique({
    where: { id: planId },
    include: { donor: { select: { name: true, email: true } }, organization: { select: { displayName: true } } },
  });
  if (!plan || plan.status === "CANCELED") return;

  if (plan.gatewaySubscriptionId) {
    try {
      const { gateway } = await resolveOrgGateway(plan.organizationId);
      await gateway.cancelSubscription(plan.gatewaySubscriptionId);
    } catch (err) {
      console.warn("cancelSubscription failed:", err instanceof Error ? err.message : err);
      // Do not confirm cancellation locally when the provider did not confirm
      // it. Otherwise a live subscription could keep charging after we
      // released the sponsee and sent a false confirmation.
      throw new PaymentError("Não foi possível confirmar o cancelamento no gateway. Tente novamente.");
    }
  }

  await prisma.recurringPlan.update({
    where: { id: planId },
    data: { status: "CANCELED", canceledAt: new Date() },
  });
  await releaseSponseeForPlan(prisma, planId);
  await prisma.auditLog.create({
    data: {
      organizationId: plan.organizationId,
      action: "recurring.canceled",
      entity: "RecurringPlan",
      entityId: planId,
      diff: { reason },
    },
  });
  await sendEmail(
    plan.donor.email,
    recurringCanceledEmail({ donorName: plan.donor.name, orgName: plan.organization.displayName, reason }),
  );
  await emitOutboundEvent(plan.organizationId, "recurring.canceled", { recurringPlanId: planId, reason });
}

/** Donor self-service — no auth, guarded only by the unguessable token. */
export async function cancelRecurringByToken(token: string): Promise<RecurringResult> {
  try {
    const plan = await prisma.recurringPlan.findUnique({ where: { cancelToken: token }, select: { id: true } });
    if (!plan) return { ok: false, error: "Assinatura não encontrada" };
    await cancelPlan(plan.id, "requested");
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/r/${token}`);
  return { ok: true };
}

/** Org-initiated cancel from the donor detail screen. */
export async function cancelRecurringForOrg(organizationId: string, recurringPlanId: string): Promise<RecurringResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "EDITOR");
    const plan = await db.recurringPlan.findFirst({ where: { id: recurringPlanId }, select: { id: true } });
    if (!plan) return { ok: false, error: "Assinatura não encontrada" };
    await cancelPlan(plan.id, "requested");
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}`);
  return { ok: true };
}
