import "server-only";
import { prisma, withDbRetry } from "@donation/db";

/**
 * Read-only headline aggregates for each panel list page, scoped to one org.
 * Pages feed the numbers into <SummaryStrip>. Kept deliberately cheap
 * (group-by + one aggregate); nothing here mutates.
 */

const countByStatus = (rows: { status: string; _count: number }[]) =>
  Object.fromEntries(rows.map((r) => [r.status, r._count])) as Record<string, number>;

export async function getCampaignsSummary(organizationId: string) {
  const [byStatus, agg] = await withDbRetry(() =>
    Promise.all([
      prisma.campaign.groupBy({ by: ["status"], where: { organizationId }, _count: true }),
      prisma.campaign.aggregate({ where: { organizationId }, _sum: { raisedCents: true, donorsCount: true } }),
    ]),
  );
  const s = countByStatus(byStatus);
  return {
    total: byStatus.reduce((a, r) => a + r._count, 0),
    published: s.PUBLISHED ?? 0,
    raisedCents: agg._sum.raisedCents ?? 0,
    donorsCount: agg._sum.donorsCount ?? 0,
    byStatus: { PUBLISHED: s.PUBLISHED ?? 0, DRAFT: s.DRAFT ?? 0, PAUSED: s.PAUSED ?? 0, CLOSED: s.CLOSED ?? 0 },
  };
}

export async function getRafflesSummary(organizationId: string) {
  const [byStatus, raffles, paidGroups] = await withDbRetry(() =>
    Promise.all([
      prisma.raffle.groupBy({ by: ["status"], where: { organizationId }, _count: true }),
      prisma.raffle.findMany({ where: { organizationId }, select: { id: true, ticketPriceCents: true } }),
      prisma.raffleTicket.groupBy({ by: ["raffleId"], where: { organizationId, status: "PAID" }, _count: true }),
    ]),
  );
  const s = countByStatus(byStatus);
  const priceById = new Map(raffles.map((r) => [r.id, r.ticketPriceCents]));
  let soldNumbers = 0;
  let revenueCents = 0;
  for (const g of paidGroups) {
    soldNumbers += g._count;
    revenueCents += g._count * (priceById.get(g.raffleId) ?? 0);
  }
  return {
    total: byStatus.reduce((a, r) => a + r._count, 0),
    open: s.OPEN ?? 0,
    soldNumbers,
    revenueCents,
    byStatus: {
      OPEN: s.OPEN ?? 0,
      DRAFT: s.DRAFT ?? 0,
      CLOSED: s.CLOSED ?? 0,
      DRAWN: s.DRAWN ?? 0,
      CANCELED: s.CANCELED ?? 0,
    },
  };
}

export async function getEventsSummary(organizationId: string) {
  const [byStatus, types, ticketsSold] = await withDbRetry(() =>
    Promise.all([
      prisma.event.groupBy({ by: ["status"], where: { organizationId }, _count: true }),
      prisma.eventTicketType.findMany({ where: { organizationId }, select: { sold: true, priceCents: true } }),
      prisma.eventTicket.count({ where: { organizationId, status: { in: ["VALID", "USED"] } } }),
    ]),
  );
  const s = countByStatus(byStatus);
  return {
    total: byStatus.reduce((a, r) => a + r._count, 0),
    published: s.PUBLISHED ?? 0,
    ticketsSold,
    revenueCents: types.reduce((a, t) => a + t.sold * t.priceCents, 0),
    byStatus: {
      PUBLISHED: s.PUBLISHED ?? 0,
      DRAFT: s.DRAFT ?? 0,
      ENDED: s.ENDED ?? 0,
      CANCELED: s.CANCELED ?? 0,
    },
  };
}

export async function getAuctionsSummary(organizationId: string) {
  const [byStatus, lotsByStatus] = await withDbRetry(() =>
    Promise.all([
      prisma.auction.groupBy({ by: ["status"], where: { organizationId }, _count: true }),
      prisma.lot.groupBy({ by: ["status"], where: { organizationId }, _count: true }),
    ]),
  );
  const s = countByStatus(byStatus);
  const l = countByStatus(lotsByStatus);
  return {
    total: byStatus.reduce((a, r) => a + r._count, 0),
    open: s.OPEN ?? 0,
    lots: lotsByStatus.reduce((a, r) => a + r._count, 0),
    soldLots: l.SOLD ?? 0,
    byStatus: {
      OPEN: s.OPEN ?? 0,
      DRAFT: s.DRAFT ?? 0,
      ENDED: s.ENDED ?? 0,
      SETTLED: s.SETTLED ?? 0,
      CANCELED: s.CANCELED ?? 0,
    },
  };
}

export async function getSponseesSummary(organizationId: string) {
  const [byStatus, committed] = await withDbRetry(() =>
    Promise.all([
      prisma.sponsee.groupBy({ by: ["status"], where: { organizationId }, _count: true }),
      prisma.sponsee.aggregate({ where: { organizationId, status: "SPONSORED" }, _sum: { monthlyAmountCents: true } }),
    ]),
  );
  const s = countByStatus(byStatus);
  return {
    total: byStatus.reduce((a, r) => a + r._count, 0),
    sponsored: s.SPONSORED ?? 0,
    available: s.AVAILABLE ?? 0,
    monthlyCommittedCents: committed._sum.monthlyAmountCents ?? 0,
    byStatus: { SPONSORED: s.SPONSORED ?? 0, AVAILABLE: s.AVAILABLE ?? 0, RETIRED: s.RETIRED ?? 0 },
  };
}
