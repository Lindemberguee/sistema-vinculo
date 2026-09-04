import { createHash, randomUUID } from "node:crypto";
import { prisma, Prisma, renderOrgEmail, resolveOrgSender, type PaymentMethod } from "@donation/db";
import { addInterval, ForbiddenError, formatBRL, NotFoundError, ValidationError } from "@donation/shared";
import { sendEmail } from "@donation/emails";
import {
  BYOG_FEE_CONFIG,
  calculateFees,
  type CreateOrderInput,
} from "@donation/payments";
import { getOrgGateway } from "@/server/payments/resolve";
import { emitOutboundEvent } from "@/server/webhooks/emit";

export interface CreateDonationParams {
  organizationId: string;
  campaignSlug: string;
  amountCents: number;
  tipCents: number;
  method: PaymentMethod;
  recurring: boolean;
  /** When set, this is an apadrinhamento — forces a monthly recurrence earmarked to the sponsee. */
  sponseeId?: string;
  /** When set, the donor picked a campaign reward ("cota"). One-off only. */
  rewardId?: string;
  /** When set, the donor arrived through a trackable donation link (/l/{slug}). */
  donationLinkId?: string;
  /** When set, the donation is credited to a campaign ambassador's page. */
  ambassadorId?: string;
  installments?: number;
  cardToken?: string;
  anonymous: boolean;
  message?: string;
  /** "Dedico esta doação a …" — only stored when the campaign enables it. */
  dedication?: { to: string; message?: string };
  donor: {
    name: string;
    email: string;
    document?: string;
    phone?: string;
  };
  consent: { email: boolean; whatsapp: boolean };
  metadata: Record<string, string>;
  ip: string;
}

const METHOD_LABEL: Record<string, string> = {
  PIX: "Pix",
  CREDIT_CARD: "Cartão de crédito",
  BOLETO: "Boleto",
};
const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;

/**
 * The single entry point for creating a donation. Validates the campaign,
 * upserts the donor, computes fees server-side (never trusts the client),
 * calls the gateway with an idempotency key, and persists a PENDING donation.
 * Confirmation happens later, only via webhook.
 */
export async function createDonation(params: CreateDonationParams) {
  const org = await prisma.organization.findUnique({
    where: { id: params.organizationId },
    select: { id: true, displayName: true, status: true, planId: true },
  });
  if (!org) throw new NotFoundError("Organization");
  if (org.status !== "ACTIVE") {
    throw new ForbiddenError("This organization is not yet able to receive donations");
  }
  // Resolve the org's gateway (BYOG) — throws if it hasn't connected/verified one.
  const resolved = await getOrgGateway(org.id);
  const gateway = resolved.gateway;

  const campaign = await prisma.campaign.findUnique({
    where: { organizationId_slug: { organizationId: org.id, slug: params.campaignSlug } },
    select: {
      id: true,
      title: true,
      status: true,
      minAmountCents: true,
      allowRecurring: true,
      allowTip: true,
      dedicationEnabled: true,
    },
  });
  if (!campaign) throw new NotFoundError("Campaign");
  if (campaign.status !== "PUBLISHED") throw new ForbiddenError("Campaign is not open for donations");
  if (params.amountCents < campaign.minAmountCents) {
    throw new ValidationError(`Minimum donation is ${campaign.minAmountCents} cents`);
  }
  const isSponsorship = Boolean(params.sponseeId);
  const wantsRecurring = params.recurring || isSponsorship;
  if (wantsRecurring && !campaign.allowRecurring) throw new ValidationError("Recurring donations are disabled for this campaign");

  let rewardId: string | undefined;
  if (params.rewardId) {
    if (wantsRecurring) throw new ValidationError("Recompensas não estão disponíveis para doação recorrente");
    const reward = await prisma.campaignReward.findFirst({
      where: { id: params.rewardId, campaignId: campaign.id },
      select: { id: true, amountCents: true, quantity: true, claimed: true },
    });
    if (!reward) throw new NotFoundError("Reward");
    if (reward.quantity != null && reward.claimed >= reward.quantity) {
      throw new ValidationError("Esta cota está esgotada");
    }
    if (params.amountCents < reward.amountCents) params.amountCents = reward.amountCents;
    rewardId = reward.id;
  }

  // Trackable donation link. A paused/expired link mid-checkout is not worth
  // blocking a willing donor — we just drop the attribution. A locked amount,
  // though, is enforced here and never trusted from the client.
  let donationLinkId: string | undefined;
  if (params.donationLinkId) {
    const link = await prisma.donationLink.findFirst({
      where: { id: params.donationLinkId, campaignId: campaign.id },
      select: { id: true, status: true, expiresAt: true, amountCents: true, lockAmount: true },
    });
    if (link && link.status === "ACTIVE" && (!link.expiresAt || link.expiresAt > new Date())) {
      donationLinkId = link.id;
      if (link.lockAmount && link.amountCents && link.amountCents > 0) {
        params.amountCents = Math.max(link.amountCents, campaign.minAmountCents);
      }
    }
  }

  // Peer-to-peer ambassador attribution. A missing/moderated ambassador just
  // drops the credit rather than blocking the donation.
  let ambassadorId: string | undefined;
  if (params.ambassadorId) {
    const amb = await prisma.campaignAmbassador.findFirst({
      where: { id: params.ambassadorId, campaignId: campaign.id, status: "ACTIVE" },
      select: { id: true },
    });
    if (amb) ambassadorId = amb.id;
  }

  let sponsee: { id: string; monthlyAmountCents: number } | null = null;
  if (params.sponseeId) {
    if (params.method === "BOLETO") throw new ValidationError("Apadrinhamento aceita apenas Pix ou cartão");
    sponsee = await prisma.sponsee.findFirst({
      where: { id: params.sponseeId, organizationId: org.id, status: { in: ["AVAILABLE", "SPONSORED"] } },
      select: { id: true, monthlyAmountCents: true },
    });
    if (!sponsee) throw new NotFoundError("Sponsee");
  }

  const tipCents = campaign.allowTip ? params.tipCents : 0;
  const dedication =
    campaign.dedicationEnabled && params.dedication?.to?.trim()
      ? {
          dedicationTo: params.dedication.to.trim().slice(0, 120),
          dedicationMessage: params.dedication.message?.trim().slice(0, 500) || null,
        }
      : { dedicationTo: null, dedicationMessage: null };

  const fees = calculateFees({
    amountCents: params.amountCents,
    tipCents,
    config: BYOG_FEE_CONFIG,
  });

  // Upsert donor within the org.
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
      consent: { ...params.consent, at: new Date().toISOString(), source: "checkout", ip: params.ip },
    },
    update: {
      name: params.donor.name,
      phone: params.donor.phone ?? undefined,
      documentHash: documentHash ?? undefined,
      consent: { ...params.consent, at: new Date().toISOString(), source: "checkout", ip: params.ip },
    },
    select: { id: true },
  });

  const split: CreateOrderInput["split"] = [];

  const recurringCard = wantsRecurring && params.method === "CREDIT_CARD";
  const recurringPix = wantsRecurring && params.method === "PIX";

  // ── Card subscription: no Donation row now — the `subscription.charged`
  //    webhook creates one per cycle (including the first). ─────────────
  if (recurringCard) {
    if (!params.cardToken) throw new ValidationError("cardToken is required for a card subscription");

    const planRow = await prisma.recurringPlan.create({
      data: {
        organizationId: org.id,
        donorId: donor.id,
        campaignId: campaign.id,
        sponseeId: sponsee?.id,
        amountCents: params.amountCents,
        tipCents,
        method: "CREDIT_CARD",
        interval: "MONTHLY",
        status: "ACTIVE",
        nextChargeAt: addInterval(new Date(), "MONTHLY"),
        donationLinkId,
        ambassadorId,
      },
      select: { id: true },
    });

    const { subscriptionId } = await gateway.createSubscription({
      recurringPlanId: planRow.id,
      amountCents: fees.chargeTotalCents,
      intervalMonths: 1,
      split,
      customer: {
        name: params.donor.name,
        email: params.donor.email,
        document: params.donor.document?.replace(/\D/g, ""),
      },
      cardToken: params.cardToken,
    });

    await prisma.recurringPlan.update({ where: { id: planRow.id }, data: { gatewaySubscriptionId: subscriptionId } });

    return {
      donation: { id: planRow.id, status: "PENDING" as const, paymentDetails: null },
      fees,
      recurring: true as const,
    };
  }

  // ── One-off charge (or the first cycle of a Pix recurrence). ─────────
  let recurringPlanId: string | undefined;
  if (recurringPix) {
    const planRow = await prisma.recurringPlan.create({
      data: {
        organizationId: org.id,
        donorId: donor.id,
        campaignId: campaign.id,
        sponseeId: sponsee?.id,
        amountCents: params.amountCents,
        tipCents,
        method: "PIX",
        interval: "MONTHLY",
        status: "ACTIVE",
        nextChargeAt: addInterval(new Date(), "MONTHLY"),
        lastAttemptAt: new Date(),
        donationLinkId,
        ambassadorId,
      },
      select: { id: true },
    });
    recurringPlanId = planRow.id;
  }

  const donationId = randomUUID();
  const orderInput: CreateOrderInput = {
    donationId,
    method: params.method,
    chargeTotalCents: fees.chargeTotalCents,
    split,
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
    metadata: { ...params.metadata, donationId, organizationId: org.id, campaignId: campaign.id },
  };

  const order = await gateway.createOrder(orderInput);

  // Card charges are usually approved synchronously. When that happens we apply
  // the "paid" side-effects here (aggregates, paidAt, receipt) — the async
  // `charge.paid` webhook then no-ops on the status guard, so nothing is counted
  // twice. Pix/boleto come back "pending" and are driven entirely by the webhook.
  const paidNow = order.status === "paid" && !recurringPlanId;

  const donation = await prisma.$transaction(async (tx) => {
    const created = await tx.donation.create({
      data: {
        id: donationId,
        organizationId: org.id,
        campaignId: campaign.id,
        donorId: donor.id,
        recurringPlanId,
        rewardId,
        donationLinkId,
        ambassadorId,
        amountCents: params.amountCents,
        tipCents,
        platformFeeCents: fees.platformFeeCents,
        netToOrgCents: fees.netToOrgCents,
        method: params.method,
        status: order.status === "paid" ? "PAID" : order.status === "failed" ? "FAILED" : "PENDING",
        paidAt: paidNow ? new Date() : null,
        anonymous: params.anonymous,
        message: params.message,
        dedicationTo: dedication.dedicationTo,
        dedicationMessage: dedication.dedicationMessage,
        gatewayOrderId: order.gatewayOrderId,
        gatewayChargeId: order.gatewayChargeId,
        paymentDetails: order.pix ?? order.boleto ?? undefined,
        metadata: orderInput.metadata,
      },
      select: { id: true, status: true, paymentDetails: true },
    });

    if (paidNow) {
      await tx.campaign.update({
        where: { id: campaign.id },
        data: { raisedCents: { increment: params.amountCents }, donorsCount: { increment: 1 } },
      });
      const d = await tx.donor.findUniqueOrThrow({ where: { id: donor.id }, select: { firstDonationAt: true } });
      await tx.donor.update({
        where: { id: donor.id },
        data: {
          totalDonatedCents: { increment: params.amountCents },
          donationsCount: { increment: 1 },
          lastDonationAt: new Date(),
          firstDonationAt: d.firstDonationAt ?? new Date(),
        },
      });
      if (rewardId) {
        await tx.campaignReward.update({ where: { id: rewardId }, data: { claimed: { increment: 1 } } });
      }
      if (donationLinkId) {
        await tx.donationLink.update({
          where: { id: donationLinkId },
          data: { donationsCount: { increment: 1 }, raisedCents: { increment: params.amountCents } },
        });
      }
      if (ambassadorId) {
        await tx.campaignAmbassador.update({
          where: { id: ambassadorId },
          data: { donationsCount: { increment: 1 }, raisedCents: { increment: params.amountCents } },
        });
      }
      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          action: "donation.paid",
          entity: "Donation",
          entityId: created.id,
          diff: { synchronous: true, amountCents: params.amountCents } as Prisma.InputJsonValue,
        },
      });
    }

    return created;
  });

  if (paidNow) {
    try {
      const [sender, receipt] = await Promise.all([
        resolveOrgSender(org.id),
        renderOrgEmail(org.id, "DONATION_THANKS", {
          NOME: firstName(params.donor.name),
          ORGANIZACAO: org.displayName,
          VALOR: formatBRL(params.amountCents),
          TOTAL: formatBRL(params.amountCents + tipCents),
          METODO: METHOD_LABEL[params.method] ?? params.method,
          DATA: new Date().toLocaleString("pt-BR"),
          CAMPANHA: campaign.title,
        }),
      ]);
      await sendEmail(params.donor.email, receipt, { from: sender.from, replyTo: sender.replyTo });
    } catch (e) {
      console.error("sync-paid receipt e-mail failed:", e);
    }
    try {
      await emitOutboundEvent(org.id, "donation.paid", {
        donationId: donation.id,
        campaignId: campaign.id,
        donorId: donor.id,
        amountCents: params.amountCents,
        tipCents,
        method: params.method,
        recurring: false,
      });
    } catch (e) {
      console.error("sync-paid outbound event failed:", e);
    }
    // Note: the first-donation "welcome" e-mail is only sent on the webhook path
    // (worker `maybeSendWelcome`). A synchronously-paid card donor misses it.
  }

  // Boleto comes back pending: e-mail the PDF link + line so the donor can pay after leaving.
  if (!paidNow && params.method === "BOLETO" && order.boleto) {
    try {
      const [sender, email] = await Promise.all([
        resolveOrgSender(org.id),
        renderOrgEmail(org.id, "BOLETO_INSTRUCTIONS", {
          NOME: params.donor.name.trim().split(/\s+/)[0] || params.donor.name,
          ORGANIZACAO: org.displayName,
          VALOR: formatBRL(fees.chargeTotalCents),
          DATA: order.boleto.dueAt ? new Date(order.boleto.dueAt).toLocaleDateString("pt-BR") : "",
          LINK: order.boleto.pdfUrl,
          CODIGO: order.boleto.line,
        }),
      ]);
      await sendEmail(params.donor.email, email, { from: sender.from, replyTo: sender.replyTo });
    } catch (e) {
      console.error("boleto instructions e-mail failed:", e);
    }
  }

  return { donation, fees, recurring: Boolean(recurringPlanId) };
}
