"use server";

import { revalidatePath } from "next/cache";
import { notifyOrgTeam, withOrgContext } from "@donation/db";
import { isAppError } from "@donation/shared";
import { requirePlatformAdmin } from "@/server/admin-helpers";
import { emitOutboundEvent } from "@/server/webhooks/emit";

export interface AdminResult {
  ok: boolean;
  error?: string;
}

/** Manual KYC approval (also the local-dev path without live Pagar.me). */
export async function approveKyc(organizationId: string): Promise<AdminResult> {
  try {
    const { userId } = await requirePlatformAdmin();
    await withOrgContext(organizationId, (tx) =>
      Promise.all([
        tx.organization.update({
          where: { id: organizationId },
          data: { status: "ACTIVE", kycStatus: "APPROVED" },
        }),
        tx.auditLog.create({
          data: {
            organizationId,
            userId,
            action: "kyc.approved",
            entity: "Organization",
            entityId: organizationId,
            diff: {},
          },
        }),
      ]),
    );
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  await emitOutboundEvent(organizationId, "kyc.approved", { organizationId });
  try {
    await notifyOrgTeam(organizationId, "kyc.approved");
  } catch (e) {
    console.error("notifyOrgTeam kyc.approved failed:", e);
  }
  revalidatePath("/admin");
  return { ok: true };
}

export async function rejectKyc(organizationId: string, reason: string): Promise<AdminResult> {
  try {
    const { userId } = await requirePlatformAdmin();
    await withOrgContext(organizationId, (tx) =>
      Promise.all([
        tx.organization.update({
          where: { id: organizationId },
          data: { status: "PENDING_KYC", kycStatus: "REJECTED" },
        }),
        tx.organizationKyc.update({
          where: { organizationId },
          data: { rejectionReason: reason.slice(0, 500) },
        }),
        tx.auditLog.create({
          data: {
            organizationId,
            userId,
            action: "kyc.rejected",
            entity: "Organization",
            entityId: organizationId,
            diff: { reason },
          },
        }),
      ]),
    );
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  try {
    await notifyOrgTeam(organizationId, "kyc.rejected", { REASON: reason });
  } catch (e) {
    console.error("notifyOrgTeam kyc.rejected failed:", e);
  }
  revalidatePath("/admin");
  return { ok: true };
}
