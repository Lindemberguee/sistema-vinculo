import "server-only";
import { Prisma, renderOrgEmail } from "@donation/db";
import { sendEmail } from "@donation/emails";
import { formatBRL } from "@donation/shared";
import type { PaymentMethod } from "@donation/db";
import { orgPublicOrigin } from "@/server/links/url";
import { emitOutboundEvent } from "@/server/webhooks/emit";

const METHOD_LABEL: Record<string, string> = { PIX: "Pix", CREDIT_CARD: "Cartão de crédito", BOLETO: "Boleto" };

/**
 * Card charges are usually approved synchronously. When a raffle / event / donation
 * order comes back already `paid`, the `charge.paid` webhook still fires later — but
 * we can't wait for it (and, in a BYOG setup, it may be misconfigured). So we apply
 * the same "paid" side-effects the worker's `markChargePaid` would, right here.
 *
 * Everything is guarded so the later webhook no-ops: the donation is already PAID,
 * and the ticket promotions match nothing on a second run.
 */

type Tx = Prisma.TransactionClient;

/** Campaign thermometer + donor CRM + audit trail for a synchronously-paid donation. */
export async function applySyncPaidAggregates(
  tx: Tx,
  opts: {
    organizationId: string;
    donationId: string;
    donorId: string;
    campaignId: string | null;
    amountCents: number;
    donationLinkId?: string | null;
    ambassadorId?: string | null;
    rewardId?: string | null;
  },
): Promise<void> {
  if (opts.campaignId) {
    await tx.campaign.update({
      where: { id: opts.campaignId },
      data: { raisedCents: { increment: opts.amountCents }, donorsCount: { increment: 1 } },
    });
  }

  const donor = await tx.donor.findUniqueOrThrow({
    where: { id: opts.donorId },
    select: { firstDonationAt: true },
  });
  await tx.donor.update({
    where: { id: opts.donorId },
    data: {
      totalDonatedCents: { increment: opts.amountCents },
      donationsCount: { increment: 1 },
      lastDonationAt: new Date(),
      firstDonationAt: donor.firstDonationAt ?? new Date(),
    },
  });

  if (opts.donationLinkId) {
    await tx.donationLink.update({
      where: { id: opts.donationLinkId },
      data: { donationsCount: { increment: 1 }, raisedCents: { increment: opts.amountCents } },
    });
  }
  if (opts.ambassadorId) {
    await tx.campaignAmbassador.update({
      where: { id: opts.ambassadorId },
      data: { donationsCount: { increment: 1 }, raisedCents: { increment: opts.amountCents } },
    });
  }
  if (opts.rewardId) {
    await tx.campaignReward.update({ where: { id: opts.rewardId }, data: { claimed: { increment: 1 } } });
  }

  await tx.auditLog.create({
    data: {
      organizationId: opts.organizationId,
      action: "donation.paid",
      entity: "Donation",
      entityId: opts.donationId,
      diff: { synchronous: true, amountCents: opts.amountCents } as Prisma.InputJsonValue,
    },
  });
}

/** Receipt e-mail + outbound `donation.paid` webhook. Call outside the transaction. */
export async function notifySyncPaid(opts: {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  donationId: string;
  campaignId: string | null;
  campaignTitle?: string;
  donorId: string;
  donorName: string;
  donorEmail: string;
  amountCents: number;
  tipCents: number;
  method: PaymentMethod;
  /** When the purchase was event tickets, also send the "your tickets + QR" e-mail. */
  event?: { title: string; venue: string; startsAt: Date; ticketCount: number };
}): Promise<void> {
  try {
    const email = await renderOrgEmail(opts.organizationId, "DONATION_THANKS", {
      NOME: opts.donorName.trim().split(/\s+/)[0] || opts.donorName,
      ORGANIZACAO: opts.organizationName,
      VALOR: formatBRL(opts.amountCents),
      TOTAL: formatBRL(opts.amountCents + opts.tipCents),
      METODO: METHOD_LABEL[opts.method] ?? opts.method,
      DATA: new Date().toLocaleString("pt-BR"),
      CAMPANHA: opts.campaignTitle ?? "",
    });
    await sendEmail(opts.donorEmail, email);
  } catch (e) {
    console.error("sync-paid receipt e-mail failed:", e);
  }

  if (opts.event) {
    try {
      const email = await renderOrgEmail(opts.organizationId, "EVENT_TICKETS", {
        NOME: opts.donorName.trim().split(/\s+/)[0] || opts.donorName,
        ORGANIZACAO: opts.organizationName,
        EVENTO: opts.event.title,
        LOCAL: opts.event.venue,
        DATA: opts.event.startsAt.toLocaleString("pt-BR"),
        LINK: `${orgPublicOrigin({ slug: opts.organizationSlug })}/e/pedido/${opts.donationId}`,
      });
      await sendEmail(opts.donorEmail, email);
    } catch (e) {
      console.error("sync-paid event tickets e-mail failed:", e);
    }
  }
  try {
    await emitOutboundEvent(opts.organizationId, "donation.paid", {
      donationId: opts.donationId,
      campaignId: opts.campaignId,
      donorId: opts.donorId,
      amountCents: opts.amountCents,
      tipCents: opts.tipCents,
      method: opts.method,
      recurring: false,
    });
  } catch (e) {
    console.error("sync-paid outbound event failed:", e);
  }
}
