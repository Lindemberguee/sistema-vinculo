import { prisma } from "@donation/db";

const GRACE_DAYS = 10;

/**
 * Daily billing pass (manual billing model — no card charging yet):
 *  - paid-plan subscriptions past their period end → PAST_DUE
 *  - PAST_DUE for more than GRACE_DAYS → suspend the org
 * Free plans (monthlyCents = 0) never enter. Reactivation is manual (admin marks paid).
 */
export async function runBillingSweep(): Promise<{ pastDue: number; suspended: number }> {
  const now = new Date();

  const overdue = await prisma.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "TRIALING"] },
      currentPeriodEnd: { lt: now },
      plan: { monthlyCents: { gt: 0 } },
    },
    select: { organizationId: true },
  });
  if (overdue.length > 0) {
    await prisma.subscription.updateMany({
      where: { organizationId: { in: overdue.map((s) => s.organizationId) } },
      data: { status: "PAST_DUE" },
    });
  }

  const graceCutoff = new Date(now.getTime() - GRACE_DAYS * 86_400_000);
  const toSuspend = await prisma.subscription.findMany({
    where: {
      status: "PAST_DUE",
      currentPeriodEnd: { lt: graceCutoff },
      plan: { monthlyCents: { gt: 0 } },
      organization: { status: { not: "SUSPENDED" } },
    },
    select: { organizationId: true },
  });

  for (const { organizationId } of toSuspend) {
    await prisma.$transaction([
      prisma.organization.update({ where: { id: organizationId }, data: { status: "SUSPENDED" } }),
      prisma.auditLog.create({
        data: {
          organizationId,
          action: "billing.auto_suspended",
          entity: "Organization",
          entityId: organizationId,
          diff: { graceDays: GRACE_DAYS },
        },
      }),
    ]);
  }

  return { pastDue: overdue.length, suspended: toSuspend.length };
}
