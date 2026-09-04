import { prisma, withDbRetry, type Prisma } from "@donation/db";

// Donor filter/segment logic is shared with the worker (broadcast fan-out).
export {
  type DonorFilters,
  type SmartListKey,
  SMART_LISTS,
  SMART_LIST_KEYS,
  parseDonorFilters,
  buildDonorWhere,
} from "@donation/db";
import type { DonorFilters } from "@donation/db";

export const DONORS_PAGE_SIZE = 25;

/** Keys that count as an "applied filter" for the results caption. */
export const DONOR_FILTER_KEYS = [
  "q",
  "segment",
  "campaignId",
  "tag",
  "recurring",
  "minReais",
  "owner",
  "task",
  "smart",
] as const;

export interface DonorSummary {
  total: number;
  donated: number; // donors with ≥1 donation
  totalDonatedCents: number;
  avgTicketCents: number;
  recurringShare: number; // 0..1
  composition: { recurring: number; oneoff: number; lead: number };
}

/** Headline numbers for the donors list, scoped to one org (ignores filters). */
export async function getDonorSummary(organizationId: string): Promise<DonorSummary> {
  const [total, donated, sums, recurring, donationsAgg] = await withDbRetry(() =>
    Promise.all([
      prisma.donor.count({ where: { organizationId } }),
      prisma.donor.count({ where: { organizationId, donationsCount: { gt: 0 } } }),
      prisma.donor.aggregate({ where: { organizationId }, _sum: { totalDonatedCents: true, donationsCount: true } }),
      prisma.donor.count({ where: { organizationId, recurring: { some: { status: "ACTIVE" } } } }),
      prisma.donor.count({
        where: { organizationId, donationsCount: { gt: 0 }, recurring: { none: { status: "ACTIVE" } } },
      }),
    ]),
  );

  const totalDonatedCents = sums._sum.totalDonatedCents ?? 0;
  const totalDonations = sums._sum.donationsCount ?? 0;

  return {
    total,
    donated,
    totalDonatedCents,
    avgTicketCents: totalDonations ? Math.round(totalDonatedCents / totalDonations) : 0,
    recurringShare: total ? recurring / total : 0,
    composition: { recurring, oneoff: donationsAgg, lead: Math.max(0, total - recurring - donationsAgg) },
  };
}

export function donorOrderBy(sort: DonorFilters["sort"]): Prisma.DonorOrderByWithRelationInput {
  if (sort === "value") return { totalDonatedCents: "desc" };
  if (sort === "frequency") return { donationsCount: "desc" };
  return { lastDonationAt: "desc" };
}

/** Percentage change prev → curr; null when there's no baseline to compare against. */
function deltaPct(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / prev) * 100;
}

export interface DashboardData {
  days: number;
  raisedCents: number;
  paidCount: number;
  avgTicketCents: number;
  uniqueDonors: number;
  newDonors: number;
  recurringActive: number;
  recurringShare: number; // 0..1 of paid donations that came from a recurring plan
  recurringRaisedCents: number;
  oneOffRaisedCents: number;
  series: number[]; // daily raised (cents), one bucket per day in the window
  delta: {
    raisedCents: number | null;
    paidCount: number | null;
    avgTicketCents: number | null;
    uniqueDonors: number | null;
  };
  funnel: { created: number; pending: number; paid: number; failedOrExpired: number };
  topCampaigns: { title: string; raisedCents: number }[];
  rangeLabel: string; // e.g. "30 de jul – 28 de ago"
  prevRangeLabel: string;
}

const DM = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
/** "30 de jul – 28 de ago" for the window [from, to). */
function rangeLabel(from: Date, to: Date): string {
  const end = new Date(to.getTime() - 86_400_000); // inclusive last day
  return `${DM.format(from)} – ${DM.format(end)}`.replace(/\./g, "");
}

/** One window's paid-donation aggregates. */
async function windowStats(organizationId: string, from: Date, to: Date) {
  const where = { organizationId, status: "PAID" as const, paidAt: { gte: from, lt: to } };
  const [agg, rows] = await withDbRetry(() =>
    Promise.all([
      prisma.donation.aggregate({ where, _sum: { amountCents: true }, _count: true }),
      prisma.donation.findMany({ where, select: { donorId: true } }),
    ]),
  );
  const raisedCents = agg._sum.amountCents ?? 0;
  const paidCount = agg._count;
  return {
    raisedCents,
    paidCount,
    avgTicketCents: paidCount ? Math.round(raisedCents / paidCount) : 0,
    uniqueDonors: new Set(rows.map((d) => d.donorId)).size,
  };
}

/** Dashboard aggregates for the trailing `days`-day window, scoped to one org. */
export async function getDashboard(organizationId: string, days: number): Promise<DashboardData> {
  const now = new Date();
  const from = new Date(now.getTime() - days * 86_400_000);
  const prevFrom = new Date(from.getTime() - days * 86_400_000);

  const paidWhere = { organizationId, status: "PAID" as const, paidAt: { gte: from } };

  const [
    curr,
    prev,
    paidRows,
    recurringActive,
    recurringAgg,
    newDonors,
    statusGroups,
    topCampaigns,
  ] = await withDbRetry(() =>
    Promise.all([
      windowStats(organizationId, from, now),
      windowStats(organizationId, prevFrom, from),
      prisma.donation.findMany({
        where: paidWhere,
        select: { paidAt: true, amountCents: true, recurringPlanId: true },
      }),
      prisma.recurringPlan.count({ where: { organizationId, status: "ACTIVE" } }),
      prisma.donation.aggregate({
        where: { ...paidWhere, recurringPlanId: { not: null } },
        _sum: { amountCents: true },
        _count: true,
      }),
      prisma.donor.count({ where: { organizationId, firstDonationAt: { gte: from } } }),
      prisma.donation.groupBy({ by: ["status"], where: { organizationId, createdAt: { gte: from } }, _count: true }),
      prisma.campaign.findMany({
        where: { organizationId },
        orderBy: { raisedCents: "desc" },
        take: 5,
        select: { title: true, raisedCents: true },
      }),
    ]),
  );

  const byStatus = Object.fromEntries(statusGroups.map((g) => [g.status, g._count]));
  const recurringRaisedCents = recurringAgg._sum.amountCents ?? 0;

  const series = new Array(days).fill(0) as number[];
  for (const row of paidRows) {
    if (!row.paidAt) continue;
    const idx = Math.floor((row.paidAt.getTime() - from.getTime()) / 86_400_000);
    if (idx >= 0 && idx < days) series[idx] = (series[idx] ?? 0) + row.amountCents;
  }

  return {
    days,
    raisedCents: curr.raisedCents,
    paidCount: curr.paidCount,
    avgTicketCents: curr.avgTicketCents,
    uniqueDonors: curr.uniqueDonors,
    newDonors,
    recurringActive,
    recurringShare: curr.paidCount ? recurringAgg._count / curr.paidCount : 0,
    recurringRaisedCents,
    oneOffRaisedCents: Math.max(0, curr.raisedCents - recurringRaisedCents),
    series,
    delta: {
      raisedCents: deltaPct(curr.raisedCents, prev.raisedCents),
      paidCount: deltaPct(curr.paidCount, prev.paidCount),
      avgTicketCents: deltaPct(curr.avgTicketCents, prev.avgTicketCents),
      uniqueDonors: deltaPct(curr.uniqueDonors, prev.uniqueDonors),
    },
    rangeLabel: rangeLabel(from, now),
    prevRangeLabel: rangeLabel(prevFrom, from),
    funnel: {
      created: byStatus.CREATED ?? 0,
      pending: byStatus.PENDING ?? 0,
      paid: byStatus.PAID ?? 0,
      failedOrExpired: (byStatus.FAILED ?? 0) + (byStatus.EXPIRED ?? 0),
    },
    topCampaigns,
  };
}
