import {
  prisma,
  isEmailTemplateEnabled,
  notifyOrgTeam,
  releaseSponseeForPlan,
  renderOrgEmail,
  resolveOrgGateway,
  resolveOrgSender,
  type DonationStatus,
  type Prisma,
} from "@donation/db";
import { sendEmail } from "@donation/emails";
import { addInterval, formatBRL } from "@donation/shared";

const METHOD_LABEL: Record<string, string> = {
  PIX: "Pix",
  CREDIT_CARD: "Cartão de crédito",
  BOLETO: "Boleto",
};
const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;
import { BYOG_FEE_CONFIG, calculateFees } from "@donation/payments";
import { emitEvent } from "./events";
import { appOrigin, orgOrigin } from "./urls";

/** Donor self-service manage/cancel link. */
export const manageUrl = (cancelToken: string) => `${appOrigin()}/r/${cancelToken}`;

const MAX_DUNNING_ATTEMPTS = 3;

/**
 * Reusable donation state mutations. Every write is guarded by the current
 * status so these are safe to call more than once for the same charge —
 * whether the trigger is a webhook or the reconciliation sweep.
 */

/** Move a PENDING/CREATED donation to PAID and update all aggregates. */
export async function markChargePaid(chargeId: string, gatewayFeeCents = 0): Promise<"applied" | "noop"> {
  let applied = false;
  let hadEventTickets = false;
  let donorId: string | undefined;
  let emit: { organizationId: string; data: Record<string, unknown> } | undefined;

  await prisma.$transaction(async (tx) => {
    const donation = await tx.donation.findUnique({ where: { gatewayChargeId: chargeId } });
    // Paid events are idempotent; terminal negative states must never be
    // resurrected by a late/out-of-order paid webhook.
    if (!donation || !["CREATED", "PENDING"].includes(donation.status)) return;
    donorId = donation.donorId;
    emit = {
      organizationId: donation.organizationId,
      data: {
        donationId: donation.id,
        campaignId: donation.campaignId,
        donorId: donation.donorId,
        amountCents: donation.amountCents,
        tipCents: donation.tipCents,
        method: donation.method,
        recurring: Boolean(donation.recurringPlanId),
      },
    };

    await tx.donation.update({
      where: { id: donation.id },
      data: { status: "PAID", paidAt: new Date(), gatewayFeeCents: gatewayFeeCents || donation.gatewayFeeCents },
    });

    if (donation.campaignId) {
      await tx.campaign.update({
        where: { id: donation.campaignId },
        data: { raisedCents: { increment: donation.amountCents }, donorsCount: { increment: 1 } },
      });
    }

    // Trackable donation link metrics.
    if (donation.donationLinkId) {
      await tx.donationLink.update({
        where: { id: donation.donationLinkId },
        data: { donationsCount: { increment: 1 }, raisedCents: { increment: donation.amountCents } },
      });
    }
    // Peer-to-peer ambassador metrics.
    if (donation.ambassadorId) {
      await tx.campaignAmbassador.update({
        where: { id: donation.ambassadorId },
        data: { donationsCount: { increment: 1 }, raisedCents: { increment: donation.amountCents } },
      });
    }

    const donor = await tx.donor.findUniqueOrThrow({
      where: { id: donation.donorId },
      select: { firstDonationAt: true },
    });
    await tx.donor.update({
      where: { id: donation.donorId },
      data: {
        totalDonatedCents: { increment: donation.amountCents },
        donationsCount: { increment: 1 },
        lastDonationAt: new Date(),
        firstDonationAt: donor.firstDonationAt ?? new Date(),
      },
    });

    // Raffle numbers paid for by this donation become PAID tickets.
    await tx.raffleTicket.updateMany({
      where: { donationId: donation.id, status: "RESERVED" },
      data: { status: "PAID", paidAt: new Date() },
    });
    // Event tickets become VALID for check-in.
    const promotedTickets = await tx.eventTicket.updateMany({
      where: { donationId: donation.id, status: "RESERVED" },
      data: { status: "VALID" },
    });
    if (promotedTickets.count > 0) hadEventTickets = true;
    // Auction lot paid for by this donation is fully settled.
    await tx.lot.updateMany({ where: { donationId: donation.id }, data: { settledAt: new Date() } });
    // A picked campaign reward ("cota") is now claimed.
    if (donation.rewardId) {
      await tx.campaignReward.update({ where: { id: donation.rewardId }, data: { claimed: { increment: 1 } } });
    }

    // A paid Pix recurrence advances its plan to the next cycle.
    if (donation.recurringPlanId) {
      const plan = await tx.recurringPlan.findUnique({
        where: { id: donation.recurringPlanId },
        select: { interval: true, status: true, sponseeId: true },
      });
      if (plan && plan.status !== "CANCELED") {
        await tx.recurringPlan.update({
          where: { id: donation.recurringPlanId },
          data: {
            status: "ACTIVE",
            failedAttempts: 0,
            nextChargeAt: addInterval(new Date(), plan.interval),
          },
        });
        if (plan.sponseeId) {
          await tx.sponsee.updateMany({
            where: { id: plan.sponseeId, status: "AVAILABLE", sponsorDonorId: null },
            data: { status: "SPONSORED", sponsorDonorId: donation.donorId, sponsoredAt: new Date() },
          });
        }
      }
    }

    await tx.auditLog.create({
      data: {
        organizationId: donation.organizationId,
        action: "donation.paid",
        entity: "Donation",
        entityId: donation.id,
        diff: { status: ["PENDING", "PAID"], amountCents: donation.amountCents } as Prisma.InputJsonValue,
      },
    });

    applied = true;
  });

  if (applied) {
    await sendReceipt(chargeId);
    if (hadEventTickets) await sendEventTickets(chargeId);
    // Boas-vindas agora é a receita WELCOME (cron diário email-automations).
    if (emit) await emitEvent(emit.organizationId, "donation.paid", emit.data);
  }
  return applied ? "applied" : "noop";
}

/** "Your tickets + QR" e-mail for a paid event order. */
async function sendEventTickets(chargeId: string): Promise<void> {
  const donation = await prisma.donation.findUnique({
    where: { gatewayChargeId: chargeId },
    select: {
      id: true,
      organizationId: true,
      donor: { select: { name: true, email: true } },
      organization: { select: { displayName: true, slug: true } },
      eventTickets: {
        select: { event: { select: { title: true, venue: true, startsAt: true } } },
      },
    },
  });
  if (!donation || donation.eventTickets.length === 0) return;
  const ev = donation.eventTickets[0]!.event;
  const ordersUrl = `${orgOrigin(donation.organization.slug)}/e/pedido/${donation.id}`;
  const [sender, email] = await Promise.all([
    resolveOrgSender(donation.organizationId),
    renderOrgEmail(donation.organizationId, "EVENT_TICKETS", {
      NOME: firstName(donation.donor.name),
      EVENTO: ev.title,
      LOCAL: ev.venue,
      DATA: ev.startsAt.toLocaleString("pt-BR"),
      LINK: ordersUrl,
    }),
  ]);
  await sendEmail(donation.donor.email, email, { from: sender.from, replyTo: sender.replyTo });
}

/**
 * Record a paid Pagar.me subscription charge as a fresh Donation and advance the
 * plan. Idempotent on `chargeId`.
 */
export async function recordSubscriptionCharge(params: {
  subscriptionId: string;
  chargeId: string;
  gatewayFeeCents?: number;
}): Promise<"applied" | "noop"> {
  const existing = await prisma.donation.findUnique({ where: { gatewayChargeId: params.chargeId }, select: { id: true } });
  if (existing) return "noop";

  const plan = await prisma.recurringPlan.findFirst({
    where: { gatewaySubscriptionId: params.subscriptionId, status: { not: "CANCELED" } },
    include: { organization: { select: { planId: true } } },
  });
  if (!plan) {
    console.warn(`recordSubscriptionCharge: no plan for subscription ${params.subscriptionId}`);
    return "noop";
  }

  const fees = calculateFees({
    amountCents: plan.amountCents,
    tipCents: plan.tipCents,
    config: BYOG_FEE_CONFIG,
  });

  await prisma.$transaction(async (tx) => {
    const donation = await tx.donation.create({
      data: {
        organizationId: plan.organizationId,
        campaignId: plan.campaignId,
        donorId: plan.donorId,
        recurringPlanId: plan.id,
        donationLinkId: plan.donationLinkId,
        ambassadorId: plan.ambassadorId,
        amountCents: plan.amountCents,
        tipCents: plan.tipCents,
        platformFeeCents: fees.platformFeeCents,
        gatewayFeeCents: params.gatewayFeeCents ?? 0,
        netToOrgCents: fees.netToOrgCents,
        method: "CREDIT_CARD",
        status: "PAID",
        gatewayChargeId: params.chargeId,
        paidAt: new Date(),
        metadata: { source: "subscription", subscriptionId: params.subscriptionId },
      },
      select: { id: true },
    });

    if (plan.campaignId) {
      await tx.campaign.update({
        where: { id: plan.campaignId },
        data: { raisedCents: { increment: plan.amountCents }, donorsCount: { increment: 1 } },
      });
    }
    if (plan.donationLinkId) {
      await tx.donationLink.update({
        where: { id: plan.donationLinkId },
        data: { donationsCount: { increment: 1 }, raisedCents: { increment: plan.amountCents } },
      });
    }
    if (plan.ambassadorId) {
      await tx.campaignAmbassador.update({
        where: { id: plan.ambassadorId },
        data: { donationsCount: { increment: 1 }, raisedCents: { increment: plan.amountCents } },
      });
    }
    const donor = await tx.donor.findUniqueOrThrow({ where: { id: plan.donorId }, select: { firstDonationAt: true } });
    await tx.donor.update({
      where: { id: plan.donorId },
      data: {
        totalDonatedCents: { increment: plan.amountCents },
        donationsCount: { increment: 1 },
        lastDonationAt: new Date(),
        firstDonationAt: donor.firstDonationAt ?? new Date(),
      },
    });
    await tx.recurringPlan.update({
      where: { id: plan.id },
      data: { status: "ACTIVE", failedAttempts: 0, lastAttemptAt: new Date(), nextChargeAt: addInterval(new Date(), plan.interval) },
    });
    if (plan.sponseeId) {
      await tx.sponsee.updateMany({
        where: { id: plan.sponseeId, status: "AVAILABLE", sponsorDonorId: null },
        data: { status: "SPONSORED", sponsorDonorId: plan.donorId, sponsoredAt: new Date() },
      });
    }
    await tx.auditLog.create({
      data: {
        organizationId: plan.organizationId,
        action: "recurring.charged",
        entity: "RecurringPlan",
        entityId: plan.id,
        diff: { donationId: donation.id } as Prisma.InputJsonValue,
      },
    });
  });

  await sendReceipt(params.chargeId);
  await emitEvent(plan.organizationId, "recurring.charged", {
    recurringPlanId: plan.id,
    donorId: plan.donorId,
    campaignId: plan.campaignId,
    amountCents: plan.amountCents,
    tipCents: plan.tipCents,
  });
  return "applied";
}

/** Card subscription charge failed → dunning. */
export async function handleSubscriptionFailure(subscriptionId: string): Promise<void> {
  const plan = await prisma.recurringPlan.findFirst({
    where: { gatewaySubscriptionId: subscriptionId },
    include: { donor: { select: { name: true, email: true } }, organization: { select: { displayName: true } } },
  });
  if (!plan || plan.status === "CANCELED") return;

  const attempts = plan.failedAttempts + 1;
  const sender = await resolveOrgSender(plan.organizationId);
  const nome = firstName(plan.donor.name);

  if (attempts >= MAX_DUNNING_ATTEMPTS) {
    try {
      const { gateway } = await resolveOrgGateway(plan.organizationId);
      await gateway.cancelSubscription(subscriptionId);
    } catch (err) {
      console.warn("cancelSubscription during dunning failed:", err instanceof Error ? err.message : err);
      // Keep the plan PAST_DUE until the provider confirms cancellation. A
      // local CANCELED state here would allow charges to continue unnoticed.
      await prisma.recurringPlan.update({
        where: { id: plan.id },
        data: { status: "PAST_DUE", failedAttempts: attempts, lastAttemptAt: new Date() },
      });
      return;
    }
    await prisma.recurringPlan.update({
      where: { id: plan.id },
      data: { status: "CANCELED", failedAttempts: attempts, canceledAt: new Date() },
    });
    await releaseSponseeForPlan(prisma, plan.id);
    const email = await renderOrgEmail(plan.organizationId, "SUBSCRIPTION_CANCELED", { NOME: nome });
    await sendEmail(plan.donor.email, email, { from: sender.from, replyTo: sender.replyTo });
    try {
      await notifyOrgTeam(plan.organizationId, "recurring.failed", {
        DOADOR: plan.donor.name,
        VALOR: formatBRL(plan.amountCents + plan.tipCents),
      });
    } catch (e) {
      console.error("notifyOrgTeam recurring.failed:", e instanceof Error ? e.message : e);
    }
  } else {
    await prisma.recurringPlan.update({
      where: { id: plan.id },
      data: { status: "PAST_DUE", failedAttempts: attempts, lastAttemptAt: new Date() },
    });
    const email = await renderOrgEmail(plan.organizationId, "DUNNING", {
      NOME: nome,
      VALOR: formatBRL(plan.amountCents + plan.tipCents),
      GERENCIAR: manageUrl(plan.cancelToken),
    });
    await sendEmail(plan.donor.email, email, { from: sender.from, replyTo: sender.replyTo });
  }
}

export async function markSubscriptionCanceled(subscriptionId: string): Promise<void> {
  const plan = await prisma.recurringPlan.findFirst({
    where: { gatewaySubscriptionId: subscriptionId, status: { not: "CANCELED" } },
    select: { id: true },
  });
  if (!plan) return;
  await prisma.recurringPlan.update({
    where: { id: plan.id },
    data: { status: "CANCELED", canceledAt: new Date() },
  });
  await releaseSponseeForPlan(prisma, plan.id);
}

/** Delete reserved event tickets for a donation and give the capacity back. */
async function releaseReservedEventTickets(donationId: string): Promise<void> {
  const tickets = await prisma.eventTicket.findMany({
    where: { donationId, status: "RESERVED" },
    select: { ticketTypeId: true },
  });
  if (tickets.length === 0) return;
  const byType = new Map<string, number>();
  for (const t of tickets) byType.set(t.ticketTypeId, (byType.get(t.ticketTypeId) ?? 0) + 1);

  await prisma.eventTicket.deleteMany({ where: { donationId, status: "RESERVED" } });
  await Promise.all(
    [...byType].map(([id, n]) =>
      prisma.eventTicketType.updateMany({ where: { id }, data: { sold: { decrement: n } } }),
    ),
  );
}

/** FAILED / EXPIRED for a not-yet-paid charge. */
export async function markChargeStatus(chargeId: string, status: DonationStatus): Promise<void> {
  const donation = await prisma.donation.findUnique({
    where: { gatewayChargeId: chargeId },
    select: {
      id: true,
      status: true,
      organizationId: true,
      recurringPlanId: true,
      amountCents: true,
      tipCents: true,
      donor: { select: { name: true, email: true } },
      organization: { select: { displayName: true, slug: true } },
      campaign: { select: { title: true, slug: true } },
    },
  });
  if (!donation || !["CREATED", "PENDING"].includes(donation.status)) return;

  await prisma.donation.update({ where: { id: donation.id }, data: { status } });
  // Free any reserved raffle numbers / event seats so they return to the pool.
  await prisma.raffleTicket.deleteMany({ where: { donationId: donation.id, status: "RESERVED" } });
  await releaseReservedEventTickets(donation.id);

  // "Doação recusada" — opt-in, one-off only (recurring failures go through dunning).
  if (status === "FAILED" && !donation.recurringPlanId) {
    try {
      if (await isEmailTemplateEnabled(donation.organizationId, "DONATION_DECLINED")) {
        const sender = await resolveOrgSender(donation.organizationId);
        const link = donation.campaign
          ? `${orgOrigin(donation.organization.slug)}/${donation.campaign.slug}`
          : orgOrigin(donation.organization.slug);
        const email = await renderOrgEmail(donation.organizationId, "DONATION_DECLINED", {
          NOME: firstName(donation.donor.name),
          ORGANIZACAO: donation.organization.displayName,
          VALOR: formatBRL(donation.amountCents + donation.tipCents),
          CAMPANHA: donation.campaign?.title ?? "",
          LINK: link,
        });
        await sendEmail(donation.donor.email, email, { from: sender.from, replyTo: sender.replyTo });
      }
    } catch (e) {
      console.error("declined e-mail failed:", e instanceof Error ? e.message : e);
    }
  }
}

/** Reverse a PAID donation (refund / chargeback) and roll back aggregates. */
export async function reverseCharge(chargeId: string, status: "REFUNDED" | "CHARGED_BACK"): Promise<void> {
  let emit: { organizationId: string; donationId: string } | undefined;

  await prisma.$transaction(async (tx) => {
    const donation = await tx.donation.findUnique({ where: { gatewayChargeId: chargeId } });
    if (!donation || donation.status !== "PAID") return;
    emit = { organizationId: donation.organizationId, donationId: donation.id };

    await tx.donation.update({ where: { id: donation.id }, data: { status, refundedAt: new Date() } });

    if (donation.campaignId) {
      await tx.campaign.update({
        where: { id: donation.campaignId },
        data: { raisedCents: { decrement: donation.amountCents }, donorsCount: { decrement: 1 } },
      });
    }
    await tx.donor.update({
      where: { id: donation.donorId },
      data: { totalDonatedCents: { decrement: donation.amountCents }, donationsCount: { decrement: 1 } },
    });
    if (donation.donationLinkId) {
      await tx.donationLink.updateMany({
        where: { id: donation.donationLinkId },
        data: { donationsCount: { decrement: 1 }, raisedCents: { decrement: donation.amountCents } },
      });
    }
    if (donation.ambassadorId) {
      await tx.campaignAmbassador.updateMany({
        where: { id: donation.ambassadorId },
        data: { donationsCount: { decrement: 1 }, raisedCents: { decrement: donation.amountCents } },
      });
    }
    // A claimed reward frees up again.
    if (donation.rewardId) {
      await tx.campaignReward.updateMany({
        where: { id: donation.rewardId, claimed: { gt: 0 } },
        data: { claimed: { decrement: 1 } },
      });
    }
    // Refunded/charged-back raffle numbers go back to the pool.
    await tx.raffleTicket.deleteMany({ where: { donationId: donation.id } });
    // An auction lot whose winning payment was reversed goes back to UNSOLD so the
    // org can re-offer it (the runner-up sweep will also pick it up).
    await tx.lot.updateMany({
      where: { donationId: donation.id },
      data: { status: "UNSOLD", donationId: null, winnerDonorId: null, winningBidCents: null, settledAt: null },
    });
    // Refunded event tickets are voided and the seats returned.
    const evt = await tx.eventTicket.findMany({ where: { donationId: donation.id, status: { not: "REFUNDED" } }, select: { ticketTypeId: true } });
    if (evt.length) {
      const byType = new Map<string, number>();
      for (const t of evt) byType.set(t.ticketTypeId, (byType.get(t.ticketTypeId) ?? 0) + 1);
      await tx.eventTicket.updateMany({ where: { donationId: donation.id }, data: { status: "REFUNDED" } });
      for (const [id, n] of byType) {
        await tx.eventTicketType.updateMany({ where: { id }, data: { sold: { decrement: n } } });
      }
    }

    await tx.auditLog.create({
      data: {
        organizationId: donation.organizationId,
        action: `donation.${status.toLowerCase()}`,
        entity: "Donation",
        entityId: donation.id,
        diff: { status: ["PAID", status] } as Prisma.InputJsonValue,
      },
    });
  });

  if (emit && status === "REFUNDED") {
    await emitEvent(emit.organizationId, "donation.refunded", { donationId: emit.donationId });
    try {
      const d = await prisma.donation.findUnique({
        where: { id: emit.donationId },
        select: {
          amountCents: true,
          tipCents: true,
          refundedAt: true,
          donor: { select: { name: true, email: true } },
          organization: { select: { displayName: true } },
          campaign: { select: { title: true } },
        },
      });
      if (d) {
        const sender = await resolveOrgSender(emit.organizationId);
        const email = await renderOrgEmail(emit.organizationId, "DONATION_REFUNDED", {
          NOME: firstName(d.donor.name),
          ORGANIZACAO: d.organization.displayName,
          VALOR: formatBRL(d.amountCents + d.tipCents),
          DATA: (d.refundedAt ?? new Date()).toLocaleDateString("pt-BR"),
          CAMPANHA: d.campaign?.title ?? "",
        });
        await sendEmail(d.donor.email, email, { from: sender.from, replyTo: sender.replyTo });
      }
    } catch (e) {
      console.error("refund e-mail failed:", e instanceof Error ? e.message : e);
    }
  }
}

export async function sendReceipt(chargeId: string): Promise<void> {
  const donation = await prisma.donation.findUnique({
    where: { gatewayChargeId: chargeId },
    include: {
      donor: true,
      organization: true,
      campaign: true,
      recurringPlan: { select: { cancelToken: true } },
    },
  });
  if (!donation || !donation.paidAt) return;

  const [sender, email] = await Promise.all([
    resolveOrgSender(donation.organizationId),
    renderOrgEmail(donation.organizationId, "DONATION_THANKS", {
      NOME: firstName(donation.donor.name),
      ORGANIZACAO: donation.organization.displayName,
      VALOR: formatBRL(donation.amountCents),
      TOTAL: formatBRL(donation.amountCents + donation.tipCents),
      METODO: METHOD_LABEL[donation.method] ?? donation.method,
      DATA: donation.paidAt.toLocaleString("pt-BR"),
      CAMPANHA: donation.campaign?.title ?? "",
    }),
  ]);
  await sendEmail(donation.donor.email, email, { from: sender.from, replyTo: sender.replyTo });
}
