import { prisma, resolveOrgGateway, type ResolvedOrgGateway } from "@donation/db";
import { markChargePaid, markChargeStatus } from "../donations";

/**
 * Safety net for lost webhooks: for each donation that has been PENDING for a
 * while, ask that org's gateway what actually happened and apply it through the
 * same guarded mutations the webhook uses.
 */
export async function reconcilePendingDonations(): Promise<{ checked: number; updated: number }> {
  const now = Date.now();

  const pending = await prisma.donation.findMany({
    where: {
      status: "PENDING",
      gatewayChargeId: { not: null },
      createdAt: { lt: new Date(now - 15 * 60_000), gt: new Date(now - 7 * 86_400_000) },
    },
    select: { id: true, organizationId: true, gatewayChargeId: true, paymentDetails: true },
    take: 200,
    orderBy: { createdAt: "asc" },
  });

  // One gateway client per org for the whole run.
  const gateways = new Map<string, ResolvedOrgGateway | null>();
  async function gatewayFor(orgId: string): Promise<ResolvedOrgGateway | null> {
    if (gateways.has(orgId)) return gateways.get(orgId)!;
    let g: ResolvedOrgGateway | null = null;
    try {
      g = await resolveOrgGateway(orgId);
    } catch (err) {
      console.warn(`reconcile: no gateway for org ${orgId}:`, err instanceof Error ? err.message : err);
    }
    gateways.set(orgId, g);
    return g;
  }

  let updated = 0;

  for (const d of pending) {
    const chargeId = d.gatewayChargeId!;
    const resolved = await gatewayFor(d.organizationId);
    if (!resolved) continue;
    let snap;
    try {
      snap = await resolved.gateway.getCharge(chargeId);
    } catch (err) {
      console.warn(`reconcile: getCharge ${chargeId} failed:`, err instanceof Error ? err.message : err);
      continue;
    }

    if (!snap) {
      // Gateway has no record — treat as failed so it stops being counted as open.
      await markChargeStatus(chargeId, "FAILED");
      updated++;
      continue;
    }

    if (snap.status === "paid") {
      const r = await markChargePaid(chargeId, snap.gatewayFeeCents ?? 0);
      if (r === "applied") updated++;
    } else if (["failed", "canceled"].includes(snap.status)) {
      await markChargeStatus(chargeId, "FAILED");
      updated++;
    } else {
      // still pending upstream — expire it locally if the QR/boleto is past due
      const pd = (d.paymentDetails ?? {}) as { expiresAt?: string; dueAt?: string };
      const due = pd.expiresAt || pd.dueAt;
      if (due && new Date(due).getTime() < now) {
        await markChargeStatus(chargeId, "EXPIRED");
        updated++;
      }
    }
  }

  // Sweep abandoned raffle reservations (>24h RESERVED, payment never landed).
  const stale = await prisma.raffleTicket.deleteMany({
    where: {
      status: "RESERVED",
      reservedAt: { lt: new Date(now - 24 * 3_600_000) },
      OR: [{ donationId: null }, { donation: { status: { notIn: ["PAID"] } } }],
    },
  });
  if (stale.count) console.log(`reconcile: released ${stale.count} stale raffle reservations`);

  // Sweep abandoned event reservations the same way (and give seats back).
  const staleEvt = await prisma.eventTicket.findMany({
    where: {
      status: "RESERVED",
      createdAt: { lt: new Date(now - 24 * 3_600_000) },
      OR: [{ donationId: null }, { donation: { status: { notIn: ["PAID"] } } }],
    },
    select: { id: true, ticketTypeId: true },
  });
  if (staleEvt.length) {
    const byType = new Map<string, number>();
    for (const t of staleEvt) byType.set(t.ticketTypeId, (byType.get(t.ticketTypeId) ?? 0) + 1);
    await prisma.eventTicket.deleteMany({ where: { id: { in: staleEvt.map((t) => t.id) } } });
    for (const [id, n] of byType) {
      await prisma.eventTicketType.updateMany({ where: { id }, data: { sold: { decrement: n } } });
    }
    console.log(`reconcile: released ${staleEvt.length} stale event reservations`);
  }

  return { checked: pending.length, updated };
}
