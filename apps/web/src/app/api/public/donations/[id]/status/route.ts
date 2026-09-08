import { NextResponse } from "next/server";
import { prisma } from "@donation/db";
import { resolveTenant } from "@/server/tenant";
import { applySyncPaidAggregates, notifySyncPaid } from "@/server/donations/sync-paid";
import { getOrgGateway } from "@/server/payments/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Front-end polls this after starting a Pix/boleto payment. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const host = _req.headers.get("x-tenant-host") ?? _req.headers.get("host") ?? "";
  const tenant = await resolveTenant(host);
  if (!tenant || tenant.kind !== "site") {
    return NextResponse.json({ error: "unknown_tenant" }, { status: 404 });
  }

  const donation = await prisma.donation.findFirst({
    where: { id, organizationId: tenant.organizationId },
    select: {
      id: true,
      organizationId: true,
      campaignId: true,
      donorId: true,
      amountCents: true,
      tipCents: true,
      method: true,
      status: true,
      paidAt: true,
      gatewayChargeId: true,
      donationLinkId: true,
      ambassadorId: true,
      rewardId: true,
      donor: { select: { name: true, email: true } },
      organization: { select: { displayName: true, slug: true } },
      campaign: { select: { title: true } },
      eventTickets: {
        take: 1,
        select: { event: { select: { title: true, venue: true, startsAt: true } } },
      },
    },
  });
  if (!donation) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const response = { id: donation.id, status: donation.status, paidAt: donation.paidAt };

  if (donation.status === "PENDING" && donation.gatewayChargeId) {
    const pendingDonation = donation;
    const gatewayChargeId = donation.gatewayChargeId;
    try {
      const { gateway } = await getOrgGateway(pendingDonation.organizationId);
      const charge = await gateway.getCharge(gatewayChargeId);
      const expectedTotal = pendingDonation.amountCents + pendingDonation.tipCents;

      if (charge?.status === "paid") {
        if (typeof charge.amountCents === "number" && charge.amountCents !== expectedTotal) {
          console.error(
            "donation status reconcile: amount mismatch",
            JSON.stringify({
              donationId: pendingDonation.id,
              chargeId: gatewayChargeId,
              expectedTotal,
              gatewayAmount: charge.amountCents,
            }),
          );
        } else {
          const now = new Date();
          const paidAt = charge.paidAt ? new Date(charge.paidAt) : now;
          let applied = false;
          await prisma.$transaction(async (tx) => {
            const claimed = await tx.donation.updateMany({
              where: { id: pendingDonation.id, organizationId: pendingDonation.organizationId, status: "PENDING" },
              data: {
                status: "PAID",
                paidAt,
                gatewayFeeCents: charge.gatewayFeeCents ?? 0,
              },
            });
            if (claimed.count !== 1) return;

            await tx.raffleTicket.updateMany({
              where: { donationId: pendingDonation.id, status: "RESERVED" },
              data: { status: "PAID", paidAt },
            });
            await tx.eventTicket.updateMany({
              where: { donationId: pendingDonation.id, status: "RESERVED" },
              data: { status: "VALID" },
            });
            await tx.lot.updateMany({ where: { donationId: pendingDonation.id }, data: { settledAt: now } });
            await applySyncPaidAggregates(tx, {
              organizationId: pendingDonation.organizationId,
              donationId: pendingDonation.id,
              donorId: pendingDonation.donorId,
              campaignId: pendingDonation.campaignId,
              amountCents: pendingDonation.amountCents,
              donationLinkId: pendingDonation.donationLinkId,
              ambassadorId: pendingDonation.ambassadorId,
              rewardId: pendingDonation.rewardId,
            });
            applied = true;
          });

          if (applied) {
            await notifySyncPaid({
              organizationId: pendingDonation.organizationId,
              organizationName: pendingDonation.organization.displayName,
              organizationSlug: pendingDonation.organization.slug,
              donationId: pendingDonation.id,
              campaignId: pendingDonation.campaignId,
              campaignTitle: pendingDonation.campaign?.title,
              donorId: pendingDonation.donorId,
              donorName: pendingDonation.donor.name,
              donorEmail: pendingDonation.donor.email,
              amountCents: pendingDonation.amountCents,
              tipCents: pendingDonation.tipCents,
              method: pendingDonation.method,
              event: pendingDonation.eventTickets[0]?.event
                ? { ...pendingDonation.eventTickets[0].event, ticketCount: pendingDonation.eventTickets.length }
                : undefined,
            });

            response.status = "PAID";
            response.paidAt = paidAt;
          }
        }
      }
    } catch (err) {
      console.error("donation status reconcile failed", err);
    }
  }

  return NextResponse.json(response);
}
