import { createHash, randomUUID } from "node:crypto";
import { Prisma, prisma, resolveOrgGateway, type PaymentMethod } from "@donation/db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@donation/shared";
import { buildSplit, calculateFees, PLATFORM_RECIPIENT_ID, type CreateOrderInput } from "@donation/payments";
import { applySyncPaidAggregates, notifySyncPaid } from "@/server/donations/sync-paid";
import { pickFreeNumbers, validateNumberSelection } from "./logic";

export interface ReserveParams {
  organizationId: string;
  raffleId: string;
  numbers?: number[];
  quantity?: number;
  method: PaymentMethod;
  cardToken?: string;
  installments?: number;
  tipCents: number;
  anonymous: boolean;
  donor: { name: string; email: string; document?: string; phone?: string };
  consent: { email: boolean; whatsapp: boolean };
  metadata: Record<string, string>;
  ip: string;
}

/**
 * Reserve raffle numbers and open a payment. Tickets are RESERVED until the
 * `charge.paid` webhook flips them to PAID; a failed/expired charge deletes them
 * so the numbers return to the pool (see worker donations.ts).
 */
export async function reserveRaffleTickets(params: ReserveParams) {
  const org = await prisma.organization.findUnique({
    where: { id: params.organizationId },
    select: { id: true, displayName: true, slug: true, status: true, gatewayRecipientId: true, planId: true },
  });
  if (!org) throw new NotFoundError("Organization");
  if (org.status !== "ACTIVE") {
    throw new ForbiddenError("This organization is not yet able to receive payments");
  }
  const { gateway, mode } = await resolveOrgGateway(org.id);

  const raffle = await prisma.raffle.findFirst({
    where: { id: params.raffleId, organizationId: org.id },
    select: {
      id: true,
      status: true,
      campaignId: true,
      ticketPriceCents: true,
      totalNumbers: true,
      minPerPurchase: true,
      maxPerPurchase: true,
      title: true,
    },
  });
  if (!raffle) throw new NotFoundError("Raffle");
  if (raffle.status !== "OPEN") throw new ForbiddenError("Rifa não está aberta para compra");

  // ── Resolve which numbers ────────────────────────
  const takenRows = await prisma.raffleTicket.findMany({
    where: { raffleId: raffle.id, status: { in: ["RESERVED", "PAID"] } },
    select: { number: true },
  });
  const taken = new Set(takenRows.map((t) => t.number));

  let numbers: number[];
  if (params.numbers && params.numbers.length > 0) {
    const v = validateNumberSelection(raffle.totalNumbers, taken, params.numbers);
    if (!v.ok) throw new ValidationError(v.reason);
    numbers = [...params.numbers].sort((a, b) => a - b);
  } else {
    const qty = params.quantity ?? 1;
    numbers = pickFreeNumbers(raffle.totalNumbers, taken, qty, `${raffle.id}:${Date.now()}:${randomUUID()}`);
  }

  if (numbers.length < raffle.minPerPurchase || numbers.length > raffle.maxPerPurchase) {
    throw new ValidationError(`Compre de ${raffle.minPerPurchase} a ${raffle.maxPerPurchase} números por vez`);
  }

  // ── Money ────────────────────────────────────────
  const amountCents = numbers.length * raffle.ticketPriceCents;
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
      consent: { ...params.consent, at: new Date().toISOString(), source: "raffle", ip: params.ip },
    },
    update: {
      name: params.donor.name,
      phone: params.donor.phone ?? undefined,
      documentHash: documentHash ?? undefined,
      consent: { ...params.consent, at: new Date().toISOString(), source: "raffle", ip: params.ip },
    },
    select: { id: true },
  });

  // ── Reserve the numbers (unique constraint guards the race) ──
  try {
    await prisma.raffleTicket.createMany({
      data: numbers.map((n) => ({
        raffleId: raffle.id,
        organizationId: org.id,
        number: n,
        status: "RESERVED" as const,
        donorId: donor.id,
      })),
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictError("Alguns números foram vendidos agora há pouco. Tente novamente.");
    }
    throw err;
  }

  // ── Open the payment ─────────────────────────────
  const donationId = randomUUID();
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
    metadata: { kind: "raffle", raffleId: raffle.id, donationId, organizationId: org.id },
  };

  let order;
  try {
    order = await gateway.createOrder(orderInput);
  } catch (err) {
    // Roll back the reservation so the numbers free up immediately.
    await prisma.raffleTicket.deleteMany({ where: { raffleId: raffle.id, number: { in: numbers }, status: "RESERVED", donorId: donor.id } });
    throw err;
  }

  // Card charges usually approve synchronously — apply the "paid" side-effects now
  // (tickets → PAID, thermometer, CRM, receipt). The later `charge.paid` webhook
  // no-ops on the status guards. Pix/boleto come back "pending" → webhook drives it.
  const paidNow = order.status === "paid";

  const donation = await prisma.$transaction(async (tx) => {
    const created = await tx.donation.create({
      data: {
        id: donationId,
        organizationId: org.id,
        campaignId: raffle.campaignId,
        donorId: donor.id,
        amountCents,
        tipCents: params.tipCents,
        platformFeeCents: fees.platformFeeCents,
        netToOrgCents: fees.netToOrgCents,
        method: params.method,
        status: order.status === "paid" ? "PAID" : order.status === "failed" ? "FAILED" : "PENDING",
        paidAt: paidNow ? new Date() : null,
        anonymous: params.anonymous,
        gatewayOrderId: order.gatewayOrderId,
        gatewayChargeId: order.gatewayChargeId,
        paymentDetails: order.pix ?? order.boleto ?? undefined,
        metadata: { kind: "raffle", raffleId: raffle.id, numbers },
      },
      select: { id: true, status: true, paymentDetails: true },
    });

    await tx.raffleTicket.updateMany({
      where: { raffleId: raffle.id, number: { in: numbers }, donorId: donor.id, status: "RESERVED" },
      data: paidNow
        ? { donationId: created.id, status: "PAID", paidAt: new Date() }
        : { donationId: created.id },
    });

    if (paidNow) {
      await applySyncPaidAggregates(tx, {
        organizationId: org.id,
        donationId: created.id,
        donorId: donor.id,
        campaignId: raffle.campaignId,
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
      campaignId: raffle.campaignId,
      campaignTitle: raffle.title,
      donorId: donor.id,
      donorName: params.donor.name,
      donorEmail: params.donor.email,
      amountCents,
      tipCents: params.tipCents,
      method: params.method,
    });
  }

  return { donation, numbers, fees };
}
