import { NextResponse } from "next/server";
import { prisma } from "@donation/db";
import { getIntlGateway, isIntlConfigured } from "@donation/payments";
import { donationReceiptEmail, sendEmail } from "@donation/emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe webhook — confirms international donations (Checkout Sessions). */
export async function POST(req: Request) {
  if (!isIntlConfigured()) return NextResponse.json({ error: "intl_disabled" }, { status: 503 });

  const raw = await req.text();
  let event;
  try {
    event = getIntlGateway().verifyWebhook(raw, req.headers);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  // Idempotency: one row per Stripe event id.
  const created = await prisma.gatewayEvent.createMany({
    data: [{ id: event.id, type: `stripe.${event.type}`, payload: event.data as object }],
    skipDuplicates: true,
  });
  if (created.count === 0) return NextResponse.json({ ok: true, duplicate: true });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data as {
        id?: string;
        payment_status?: string;
        amount_total?: number;
        metadata?: { donationId?: string };
      };
      if (session.payment_status === "paid") {
        const donationId = session.metadata?.donationId;
        await confirmIntlDonation({ donationId, sessionId: session.id, amountTotal: session.amount_total });
      }
    } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data as { id?: string };
      await prisma.donation.updateMany({
        where: { gatewayOrderId: session.id, status: { in: ["CREATED", "PENDING"] } },
        data: { status: "EXPIRED" },
      });
    }
    await prisma.gatewayEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    await prisma.gatewayEvent.update({
      where: { id: event.id },
      data: { attempts: { increment: 1 }, error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

async function confirmIntlDonation(params: { donationId?: string; sessionId?: string; amountTotal?: number }) {
  const where = params.donationId ? { id: params.donationId } : { gatewayOrderId: params.sessionId };
  const donation = await prisma.donation.findFirst({
    where: { ...where, status: { in: ["CREATED", "PENDING"] } },
    include: { donor: true, organization: true, campaign: true },
  });
  if (!donation) return;

  // Defence in depth: the session is server-created, but never mark a donation
  // paid for less than it was created for.
  if (typeof params.amountTotal === "number" && params.amountTotal < donation.amountCents) {
    console.error(
      `[stripe] amount mismatch for donation ${donation.id}: session ${params.amountTotal} < expected ${donation.amountCents} — not confirming`,
    );
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.donation.update({ where: { id: donation.id }, data: { status: "PAID", paidAt: new Date() } });
    if (donation.campaignId) {
      // International amount is not BRL — don't pollute the BRL raisedCents total,
      // just bump the donor count for the campaign funnel.
      await tx.campaign.update({ where: { id: donation.campaignId }, data: { donorsCount: { increment: 1 } } });
    }
    await tx.donor.update({
      where: { id: donation.donorId },
      data: { donationsCount: { increment: 1 }, lastDonationAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        organizationId: donation.organizationId,
        action: "donation.paid",
        entity: "Donation",
        entityId: donation.id,
        diff: { status: ["PENDING", "PAID"], currency: donation.currency } as object,
      },
    });
  });

  await sendEmail(
    donation.donor.email,
    donationReceiptEmail({
      donorName: donation.donor.name,
      orgName: donation.organization.displayName,
      campaignTitle: donation.campaign?.title,
      amountCents: donation.amountCents,
      tipCents: 0,
      method: `Cartão (${donation.currency})`,
      paidAt: new Date(),
      recurring: false,
    }),
  );
}
