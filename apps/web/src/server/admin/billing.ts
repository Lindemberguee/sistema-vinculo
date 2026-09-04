"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@donation/db";
import { addInterval, isAppError } from "@donation/shared";
import { requirePlatformAdmin } from "@/server/admin-helpers";

export interface AdminResult {
  ok: boolean;
  error?: string;
}

/** Admin plan switch — no role / isPublic restriction (can set enterprise). */
export async function adminChangePlan(organizationId: string, planId: string): Promise<AdminResult> {
  try {
    const { userId } = await requirePlatformAdmin();
    const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true } });
    if (!plan) return { ok: false, error: "Plano não encontrado" };

    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { planId: true } });
    if (!org) return { ok: false, error: "Organização não encontrada" };

    await prisma.$transaction([
      prisma.organization.update({ where: { id: organizationId }, data: { planId } }),
      prisma.subscription.updateMany({ where: { organizationId }, data: { planId } }),
      prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action: "plan.changed",
          entity: "Organization",
          entityId: organizationId,
          diff: { planId: [org.planId, planId], by: "admin" },
        },
      }),
    ]);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/admin/orgs");
  return { ok: true };
}

/** Register a payment: subscription ACTIVE, period +1 month, un-suspend if needed. */
export async function markSubscriptionPaid(organizationId: string): Promise<AdminResult> {
  try {
    const { userId } = await requirePlatformAdmin();
    const [sub, org] = await Promise.all([
      prisma.subscription.findUnique({ where: { organizationId }, select: { currentPeriodEnd: true } }),
      prisma.organization.findUnique({ where: { id: organizationId }, select: { status: true, planId: true } }),
    ]);
    if (!org) return { ok: false, error: "Organização não encontrada" };

    const base = sub && sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
    const nextEnd = addInterval(base, "MONTHLY");

    await prisma.$transaction([
      prisma.subscription.upsert({
        where: { organizationId },
        create: {
          organizationId,
          planId: org.planId,
          status: "ACTIVE",
          lastPaidAt: new Date(),
          currentPeriodEnd: nextEnd,
        },
        update: { status: "ACTIVE", lastPaidAt: new Date(), currentPeriodEnd: nextEnd },
      }),
      ...(org.status === "SUSPENDED"
        ? [prisma.organization.update({ where: { id: organizationId }, data: { status: "ACTIVE" } })]
        : []),
      prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action: "billing.marked_paid",
          entity: "Subscription",
          entityId: organizationId,
          diff: { currentPeriodEnd: nextEnd.toISOString() },
        },
      }),
    ]);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/admin/orgs");
  return { ok: true };
}

export async function setOrgStatus(
  organizationId: string,
  status: "ACTIVE" | "SUSPENDED",
): Promise<AdminResult> {
  try {
    const { userId } = await requirePlatformAdmin();
    await prisma.$transaction([
      prisma.organization.update({ where: { id: organizationId }, data: { status } }),
      prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action: status === "SUSPENDED" ? "org.suspended" : "org.reactivated",
          entity: "Organization",
          entityId: organizationId,
          diff: { by: "admin" },
        },
      }),
    ]);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/admin/orgs");
  return { ok: true };
}
