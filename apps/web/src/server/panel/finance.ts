import "server-only";
import { prisma, withDbRetry } from "@donation/db";

export interface FinanceOverview {
  grossCents: number; // amount + tip, PAID, BRL
  platformFeeCents: number;
  gatewayFeeCents: number;
  netCents: number; // netToOrgCents, PAID, BRL
  reversedCents: number; // net lost to refund / chargeback
  paidOutCents: number; // Payout.status = PAID
  balanceCents: number; // net - reversed - paidOut  (what still needs to reach the org)
  byOrigin: { title: string; netCents: number }[];
  recent: {
    id: string;
    paidAt: Date | null;
    campaignTitle: string | null;
    method: string;
    netToOrgCents: number;
  }[];
  intl: { currency: string; grossCents: number; count: number }[];
}

const BRL_PAID = (organizationId: string) =>
  ({ organizationId, status: "PAID", currency: "BRL" }) as const;

/** Money overview for the Finanças page, scoped to one org. Read-only. */
export async function getFinanceOverview(organizationId: string): Promise<FinanceOverview> {
  const [paidAgg, reversedAgg, payoutAgg, originGroups, recentRows, intlGroups] = await withDbRetry(() =>
    Promise.all([
    prisma.donation.aggregate({
      where: BRL_PAID(organizationId),
      _sum: { amountCents: true, tipCents: true, platformFeeCents: true, gatewayFeeCents: true, netToOrgCents: true },
    }),
    prisma.donation.aggregate({
      where: { organizationId, currency: "BRL", status: { in: ["REFUNDED", "CHARGED_BACK"] } },
      _sum: { netToOrgCents: true },
    }),
    prisma.payout.aggregate({ where: { organizationId, status: "PAID" }, _sum: { amountCents: true } }),
    prisma.donation.groupBy({
      by: ["campaignId"],
      where: BRL_PAID(organizationId),
      _sum: { netToOrgCents: true },
      orderBy: { _sum: { netToOrgCents: "desc" } },
      take: 6,
    }),
    prisma.donation.findMany({
      where: BRL_PAID(organizationId),
      orderBy: { paidAt: "desc" },
      take: 8,
      select: { id: true, paidAt: true, method: true, netToOrgCents: true, campaign: { select: { title: true } } },
    }),
      prisma.donation.groupBy({
        by: ["currency"],
        where: { organizationId, status: "PAID", NOT: { currency: "BRL" } },
        _sum: { amountCents: true },
        _count: true,
      }),
    ]),
  );

  const campaignIds = originGroups.map((g) => g.campaignId).filter((x): x is string => !!x);
  const titles = campaignIds.length
    ? await withDbRetry(() =>
        prisma.campaign.findMany({ where: { id: { in: campaignIds } }, select: { id: true, title: true } }),
      )
    : [];
  const titleById = new Map(titles.map((c) => [c.id, c.title]));

  const grossCents = (paidAgg._sum.amountCents ?? 0) + (paidAgg._sum.tipCents ?? 0);
  const netCents = paidAgg._sum.netToOrgCents ?? 0;
  const reversedCents = reversedAgg._sum.netToOrgCents ?? 0;
  const paidOutCents = payoutAgg._sum.amountCents ?? 0;

  return {
    grossCents,
    platformFeeCents: paidAgg._sum.platformFeeCents ?? 0,
    gatewayFeeCents: paidAgg._sum.gatewayFeeCents ?? 0,
    netCents,
    reversedCents,
    paidOutCents,
    balanceCents: Math.max(0, netCents - reversedCents - paidOutCents),
    byOrigin: originGroups.map((g) => ({
      title: g.campaignId ? (titleById.get(g.campaignId) ?? "Campanha removida") : "Sem campanha",
      netCents: g._sum.netToOrgCents ?? 0,
    })),
    recent: recentRows.map((r) => ({
      id: r.id,
      paidAt: r.paidAt,
      campaignTitle: r.campaign?.title ?? null,
      method: r.method,
      netToOrgCents: r.netToOrgCents,
    })),
    intl: intlGroups.map((g) => ({
      currency: g.currency,
      grossCents: g._sum.amountCents ?? 0,
      count: g._count,
    })),
  };
}
