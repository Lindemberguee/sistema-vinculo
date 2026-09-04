import { createHash, randomUUID } from "node:crypto";
import { prisma, resolveOrgGateway, type PaymentMethod } from "@donation/db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@donation/shared";
import { buildSplit, calculateFees, PLATFORM_RECIPIENT_ID, type CreateOrderInput } from "@donation/payments";
import { applySyncPaidAggregates, notifySyncPaid } from "@/server/donations/sync-paid";
import { computeOrderCents, validateOrderItems, type TypeInfo } from "./logic";

export interface EventOrderParams {
  organizationId: string;
  eventId: string;
  items: { ticketTypeId: string; quantity: number }[];
  attendees?: string[];
  method: PaymentMethod;
  cardToken?: string;
  installments?: number;
  tipCents: number;
  donor: { name: string; email: string; document?: string; phone?: string };
  consent: { email: boolean; whatsapp: boolean };
  metadata: Record<string, string>;
  ip: string;
}

/**
 * Reserve event tickets and open a payment. Availability is enforced with an
 * atomic conditional increment on `EventTicketType.sold` — no oversell race.
 */
export async function createEventOrder(params: EventOrderParams) {
  const org = await prisma.organization.findUnique({
    where: { id: params.organizationId },
    select: { id: true, displayName: true, slug: true, status: true, gatewayRecipientId: true, planId: true },
  });
  if (!org) throw new NotFoundError("Organization");
  if (org.status !== "ACTIVE") {
    throw new ForbiddenError("This organization is not yet able to receive payments");
  }
  const { gateway, mode } = await resolveOrgGateway(org.id);

  const event = await prisma.event.findFirst({
    where: { id: params.eventId, organizationId: org.id },
    select: { id: true, status: true, campaignId: true, title: true, venue: true, startsAt: true, ticketTypes: true },
  });
  if (!event) throw new NotFoundError("Event");
  if (event.status !== "PUBLISHED") throw new ForbiddenError("Evento não está com vendas abertas");

  const typeInfo: Record<string, TypeInfo> = {};
  for (const tt of event.ticketTypes) {
    typeInfo[tt.id] = {
      priceCents: tt.priceCents,
      available: Math.max(0, tt.quantity - tt.sold),
      maxPerOrder: tt.maxPerOrder,
    };
  }

  const items = params.items.filter((i) => i.quantity > 0);
  const v = validateOrderItems(items, typeInfo);
  if (!v.ok) throw new ValidationError(v.reason);

  const amountCents = computeOrderCents(items, typeInfo);
  const plan = await prisma.plan.findUniqueOrThrow({
    where: { id: org.planId },
    select: { platformFeeBps: true, platformFeeFixedCents: true },
  });
  const fees = calculateFees({
    amountCents,
    tipCents: params.tipCents,
    config: { platformFeeBps: plan.platformFeeBps, platformFeeFixedCents: plan.platformFeeFixedCents },
  });

  const documentHash = params.donor.document
    ? createHash("sha256").update(params.donor.document.replace(/\D/g, "")).digest("hex")
    : undefined;
  const donor = await prisma.donor.upsert({
    where: { organizationId_email: { organizationId: org.id, email: params.donor.email.toLowerCase() } },
    create: {
      organizationId: org.id,
      email: params.donor.email.toLowerCase(),
      name: params.donor.name,
      phone: params.donor.phone,
      documentHash,
      consent: { ...params.consent, at: new Date().toISOString(), source: "event", ip: params.ip },
    },
    update: {
      name: params.donor.name,
      phone: params.donor.phone ?? undefined,
      documentHash: documentHash ?? undefined,
      consent: { ...params.consent, at: new Date().toISOString(), source: "event", ip: params.ip },
    },
    select: { id: true },
  });

  // ── Atomically claim capacity + create RESERVED tickets ──
  const donationId = randomUUID();
  const claimedTypes: { ticketTypeId: string; quantity: number }[] = [];
  const attendeePool = [...(params.attendees ?? [])];

  try {
    await prisma.$transaction(async (tx) => {
      for (const it of items) {
        const tt = event.ticketTypes.find((t) => t.id === it.ticketTypeId)!;
        const claim = await tx.eventTicketType.updateMany({
          where: { id: tt.id, sold: { lte: tt.quantity - it.quantity } },
          data: { sold: { increment: it.quantity } },
        });
        if (claim.count === 0) throw new ConflictError(`"${tt.name}" esgotou enquanto você comprava. Tente de novo.`);
        claimedTypes.push({ ticketTypeId: tt.id, quantity: it.quantity });

        await tx.eventTicket.createMany({
          data: Array.from({ length: it.quantity }, () => ({
            eventId: event.id,
            ticketTypeId: tt.id,
            organizationId: org.id,
            donorId: donor.id,
            donationId,
            status: "RESERVED" as const,
            attendeeName: attendeePool.shift() ?? null,
          })),
        });
      }
    });
  } catch (err) {
    // best-effort rollback of any sold increments (the tx already rolled the rows back)
    await Promise.all(
      claimedTypes.map((c) =>
        prisma.eventTicketType.updateMany({ where: { id: c.ticketTypeId }, data: { sold: { decrement: c.quantity } } }),
      ),
    ).catch(() => {});
    throw err;
  }

  // ── Open the payment ─────────────────────────────
  const orderInput: CreateOrderInput = {
    donationId,
    method: params.method,
    chargeTotalCents: fees.chargeTotalCents,
    split:
      mode === "MANAGED" && org.gatewayRecipientId
        ? buildSplit({ breakdown: fees, orgRecipientId: org.gatewayRecipientId, platformRecipientId: PLATFORM_RECIPIENT_ID() })
        : [],
    customer: {
      name: params.donor.name,
      email: params.donor.email,
      document: params.donor.document?.replace(/\D/g, ""),
      phone: params.donor.phone,
    },
    cardToken: params.cardToken,
    installments: params.installments,
    statementDescriptor: org.displayName.slice(0, 13),
    expiresInSeconds: params.method === "BOLETO" ? 3 * 24 * 3600 : 3600,
    metadata: { kind: "event", eventId: event.id, donationId, organizationId: org.id },
  };

  let gwOrder;
  try {
    gwOrder = await gateway.createOrder(orderInput);
  } catch (err) {
    // Undo the reservation: delete tickets, decrement sold.
    await prisma.eventTicket.deleteMany({ where: { donationId } });
    await Promise.all(
      claimedTypes.map((c) =>
        prisma.eventTicketType.updateMany({ where: { id: c.ticketTypeId }, data: { sold: { decrement: c.quantity } } }),
      ),
    );
    throw err;
  }

  // Card charges usually approve synchronously — apply the "paid" side-effects now
  // (tickets → VALID for check-in, thermometer, CRM, receipt). The later
  // `charge.paid` webhook no-ops on the status guards.
  const paidNow = gwOrder.status === "paid";

  const donation = await prisma.$transaction(async (tx) => {
    const created = await tx.donation.create({
      data: {
        id: donationId,
        organizationId: org.id,
        campaignId: event.campaignId,
        donorId: donor.id,
        amountCents,
        tipCents: params.tipCents,
        platformFeeCents: fees.platformFeeCents,
        netToOrgCents: fees.netToOrgCents,
        method: params.method,
        status: gwOrder.status === "paid" ? "PAID" : gwOrder.status === "failed" ? "FAILED" : "PENDING",
        paidAt: paidNow ? new Date() : null,
        gatewayOrderId: gwOrder.gatewayOrderId,
        gatewayChargeId: gwOrder.gatewayChargeId,
        paymentDetails: gwOrder.pix ?? gwOrder.boleto ?? undefined,
        metadata: { kind: "event", eventId: event.id },
      },
      select: { id: true, status: true, paymentDetails: true },
    });

    if (paidNow) {
      await tx.eventTicket.updateMany({
        where: { donationId, status: "RESERVED" },
        data: { status: "VALID" },
      });
      await applySyncPaidAggregates(tx, {
        organizationId: org.id,
        donationId: created.id,
        donorId: donor.id,
        campaignId: event.campaignId,
        amountCents,
      });
    }

    return created;
  });

  if (paidNow) {
    await notifySyncPaid({
      organizationId: org.id,
      organizationName: org.displayName,
      organizationSlug: org.slug,
      donationId: donation.id,
      campaignId: event.campaignId,
      campaignTitle: event.title,
      donorId: donor.id,
      donorName: params.donor.name,
      donorEmail: params.donor.email,
      amountCents,
      tipCents: params.tipCents,
      method: params.method,
      event: {
        title: event.title,
        venue: event.venue,
        startsAt: event.startsAt,
        ticketCount: items.reduce((s, i) => s + i.quantity, 0),
      },
    });
  }

  const codes = await prisma.eventTicket.findMany({ where: { donationId }, select: { code: true } });
  return { donation, ticketCodes: codes.map((c) => c.code), fees };
}
