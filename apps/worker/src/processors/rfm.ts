import { prisma } from "@donation/db";
import { scorePopulation, type RfmMetrics } from "@donation/shared";

/**
 * Recompute the RFM segment for every donor of every (or one) organization.
 * Cheap enough to run nightly; segments are relative to each org's own base.
 */
export async function recomputeRfm(organizationId?: string): Promise<{ orgs: number; donors: number }> {
  const orgs = await prisma.organization.findMany({
    where: { ...(organizationId ? { id: organizationId } : {}), status: { not: "SUSPENDED" } },
    select: { id: true },
  });

  const now = Date.now();
  let touched = 0;

  for (const org of orgs) {
    const donors = await prisma.donor.findMany({
      where: { organizationId: org.id, donationsCount: { gt: 0 } },
      select: { id: true, donationsCount: true, totalDonatedCents: true, lastDonationAt: true },
    });
    if (donors.length === 0) continue;

    const metrics: RfmMetrics[] = donors.map((d) => ({
      recencyDays: d.lastDonationAt ? Math.max(0, Math.floor((now - d.lastDonationAt.getTime()) / 86_400_000)) : 3650,
      frequency: d.donationsCount,
      monetaryCents: d.totalDonatedCents,
    }));

    const scores = scorePopulation(metrics);

    // Batch the updates in chunks to keep the pool happy.
    for (let i = 0; i < donors.length; i += 50) {
      const slice = donors.slice(i, i + 50);
      await prisma.$transaction(
        slice.map((d, j) =>
          prisma.donor.update({ where: { id: d.id }, data: { rfmSegment: scores[i + j]!.segment } }),
        ),
      );
    }
    touched += donors.length;
  }

  return { orgs: orgs.length, donors: touched };
}
