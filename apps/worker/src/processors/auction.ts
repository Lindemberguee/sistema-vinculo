import { randomUUID } from "node:crypto";
import { prisma, renderOrgEmail, resolveOrgGateway, resolveOrgSender } from "@donation/db";
import { formatBRL } from "@donation/shared";
import { buildSplit, calculateFees, PLATFORM_RECIPIENT_ID } from "@donation/payments";
import { sendEmail } from "@donation/emails";

const nm = (n: string) => n.trim().split(/\s+/)[0] || n;

const APP_BASE = process.env.APP_BASE_DOMAIN ?? "localhost:3000";
const scheme = APP_BASE.includes("localhost") ? "http" : "https";

const PIX_TTL_DAYS = 5;
const REMINDER_AFTER_HOURS = 48;
const MAX_WINNER_ATTEMPTS = 3; // original winner + up to 2 runners-up

/**
 * Open a Pix charge for a lot's winner: creates the Donation, links it to the
 * lot, and e-mails the pay link. Returns true on success. `reminder` swaps the
 * "you won" copy for a nudge (same pay link).
 */
async function billWinner(params: {
  lotId: string;
  lotTitle: string;
  organizationId: string;
  campaignId: string | null;
  donorId: string;
  donorName: string;
  donorEmail: string;
  bidCents: number;
  orgName: string;
  orgSlug: string;
  orgPlanId: string;
  orgRecipientId: string | null;
}): Promise<boolean> {
  let resolved;
  try {
    resolved = await resolveOrgGateway(params.organizationId);
  } catch {
    console.warn(`auction: lot ${params.lotId} sold but org has no connected gateway`);
    return false;
  }

  try {
    const feeCfg = await prisma.plan.findUniqueOrThrow({
      where: { id: params.orgPlanId },
      select: { platformFeeBps: true, platformFeeFixedCents: true },
    });
    const fees = calculateFees({
      amountCents: params.bidCents,
      tipCents: 0,
      config: { platformFeeBps: feeCfg.platformFeeBps, platformFeeFixedCents: feeCfg.platformFeeFixedCents },
    });
    const donationId = randomUUID();
    const order = await resolved.gateway.createOrder({
      donationId,
      method: "PIX",
      chargeTotalCents: fees.chargeTotalCents,
      split:
        resolved.mode === "MANAGED" && params.orgRecipientId
          ? buildSplit({ breakdown: fees, orgRecipientId: params.orgRecipientId, platformRecipientId: PLATFORM_RECIPIENT_ID() })
          : [],
      customer: { name: params.donorName, email: params.donorEmail },
      expiresInSeconds: PIX_TTL_DAYS * 86_400,
      metadata: { kind: "auction", lotId: params.lotId },
    });

    await prisma.donation.create({
      data: {
        id: donationId,
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        donorId: params.donorId,
        amountCents: params.bidCents,
        tipCents: 0,
        platformFeeCents: fees.platformFeeCents,
        netToOrgCents: fees.netToOrgCents,
        method: "PIX",
        status: "PENDING",
        gatewayOrderId: order.gatewayOrderId,
        gatewayChargeId: order.gatewayChargeId,
        paymentDetails: order.pix ?? undefined,
        metadata: { kind: "auction", lotId: params.lotId },
      },
    });
    await prisma.lot.update({
      where: { id: params.lotId },
      data: { donationId, winnerDonorId: params.donorId, winningBidCents: params.bidCents },
    });

    const payUrl = `${scheme}://${params.orgSlug}.${APP_BASE}/l/pagar/${donationId}`;
    const [sender, email] = await Promise.all([
      resolveOrgSender(params.organizationId),
      renderOrgEmail(params.organizationId, "AUCTION_WON", {
        NOME: nm(params.donorName),
        ORGANIZACAO: params.orgName,
        LOTE: params.lotTitle,
        LANCE: formatBRL(params.bidCents),
        LINK: payUrl,
      }),
    ]);
    await sendEmail(params.donorEmail, email, { from: sender.from, replyTo: sender.replyTo });
    return true;
  } catch (err) {
    console.error(`auction: failed to bill lot ${params.lotId}:`, err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Close lots whose time is up: mark SOLD/UNSOLD and, for a winner, open a Pix
 * charge and e-mail the pay link. The winner pays after the auction — no money
 * moves during bidding.
 */
export async function settleEndedLots(): Promise<{ settled: number; sold: number }> {
  const now = new Date();
  const lots = await prisma.lot.findMany({
    // An org may have ended the auction manually before this cron runs — still settle.
    where: { status: "ACTIVE", endsAt: { lt: now }, auction: { status: { in: ["OPEN", "ENDED"] } } },
    take: 100,
    select: {
      id: true,
      title: true,
      organizationId: true,
      currentBidCents: true,
      currentBidderDonorId: true,
      auction: { select: { campaignId: true } },
    },
  });

  let sold = 0;

  for (const lot of lots) {
    if (!lot.currentBidderDonorId || !lot.currentBidCents) {
      await prisma.lot.update({ where: { id: lot.id }, data: { status: "UNSOLD" } });
      continue;
    }

    const org = await prisma.organization.findUnique({
      where: { id: lot.organizationId },
      select: { displayName: true, slug: true, status: true, gatewayRecipientId: true, planId: true },
    });
    const donor = await prisma.donor.findUnique({
      where: { id: lot.currentBidderDonorId },
      select: { name: true, email: true },
    });

    await prisma.lot.update({
      where: { id: lot.id },
      data: { status: "SOLD", winnerDonorId: lot.currentBidderDonorId, winningBidCents: lot.currentBidCents },
    });
    sold++;

    if (!org || org.status !== "ACTIVE" || !donor) {
      console.warn(`settle: lot ${lot.id} sold but cannot bill (org not ready)`);
      continue;
    }

    await billWinner({
      lotId: lot.id,
      lotTitle: lot.title,
      organizationId: lot.organizationId,
      campaignId: lot.auction.campaignId,
      donorId: lot.currentBidderDonorId,
      donorName: donor.name,
      donorEmail: donor.email,
      bidCents: lot.currentBidCents,
      orgName: org.displayName,
      orgSlug: org.slug,
      orgPlanId: org.planId,
      orgRecipientId: org.gatewayRecipientId,
    });
  }

  return { settled: lots.length, sold };
}

/**
 * Chase winners who haven't paid: a 48h reminder, then — once the Pix window is
 * gone — re-offer the lot to the next-highest bidder, or mark it UNSOLD.
 * Idempotent; the reminder is sent at most once (tracked via AuditLog).
 */
export async function chaseUnpaidLots(): Promise<{ reminded: number; reoffered: number; abandoned: number }> {
  const lots = await prisma.lot.findMany({
    where: { status: "SOLD", settledAt: null, donationId: { not: null } },
    take: 100,
    select: {
      id: true,
      title: true,
      organizationId: true,
      startPriceCents: true,
      winnerDonorId: true,
      donationId: true,
      donation: { select: { id: true, status: true, createdAt: true, amountCents: true } },
      auction: { select: { campaignId: true } },
    },
  });

  let reminded = 0;
  let reoffered = 0;
  let abandoned = 0;

  for (const lot of lots) {
    const d = lot.donation;
    if (!d || d.status === "PAID") continue;

    const ageMs = Date.now() - d.createdAt.getTime();
    const windowGone =
      ["EXPIRED", "FAILED", "CANCELED", "REFUNDED", "CHARGED_BACK"].includes(d.status) ||
      ageMs > PIX_TTL_DAYS * 86_400_000;

    const org = await prisma.organization.findUnique({
      where: { id: lot.organizationId },
      select: { displayName: true, slug: true, status: true, gatewayRecipientId: true, planId: true },
    });
    if (!org) continue;

    // ── Still within the window: one reminder after 48h ──
    if (!windowGone) {
      if (ageMs < REMINDER_AFTER_HOURS * 3_600_000) continue;
      const already = await prisma.auditLog.findFirst({
        where: { entity: "Lot", entityId: lot.id, action: "auction.payment_reminder" },
        select: { id: true },
      });
      if (already) continue;

      const winner = lot.winnerDonorId
        ? await prisma.donor.findUnique({ where: { id: lot.winnerDonorId }, select: { name: true, email: true } })
        : null;
      if (winner) {
        const payUrl = `${scheme}://${org.slug}.${APP_BASE}/l/pagar/${d.id}`;
        const [sender, email] = await Promise.all([
          resolveOrgSender(lot.organizationId),
          renderOrgEmail(lot.organizationId, "AUCTION_PAYMENT_REMINDER", {
            NOME: nm(winner.name),
            ORGANIZACAO: org.displayName,
            LOTE: lot.title,
            LANCE: formatBRL(d.amountCents),
            LINK: payUrl,
          }),
        ]);
        await sendEmail(winner.email, email, { from: sender.from, replyTo: sender.replyTo });
        await prisma.auditLog.create({
          data: { organizationId: lot.organizationId, action: "auction.payment_reminder", entity: "Lot", entityId: lot.id, diff: { donationId: d.id } },
        });
        reminded++;
      }
      continue;
    }

    // ── Window gone: expire the charge, then re-offer or abandon ──
    if (["CREATED", "PENDING"].includes(d.status)) {
      await prisma.donation.update({ where: { id: d.id }, data: { status: "EXPIRED" } });
    }

    // Everyone we've already billed for this lot (so we don't loop back to them).
    const billed = await prisma.donation.findMany({
      where: { organizationId: lot.organizationId, metadata: { path: ["lotId"], equals: lot.id } },
      select: { donorId: true },
    });
    const billedDonorIds = [...new Set(billed.map((b) => b.donorId))];

    const runnerUp =
      billedDonorIds.length < MAX_WINNER_ATTEMPTS
        ? await prisma.bid.findFirst({
            where: { lotId: lot.id, donorId: { notIn: billedDonorIds }, amountCents: { gte: lot.startPriceCents } },
            orderBy: { amountCents: "desc" },
            select: { donorId: true, amountCents: true },
          })
        : null;

    if (runnerUp && org.status === "ACTIVE") {
      const donor = await prisma.donor.findUnique({ where: { id: runnerUp.donorId }, select: { name: true, email: true } });
      if (donor) {
        const ok = await billWinner({
          lotId: lot.id,
          lotTitle: lot.title,
          organizationId: lot.organizationId,
          campaignId: lot.auction.campaignId,
          donorId: runnerUp.donorId,
          donorName: donor.name,
          donorEmail: donor.email,
          bidCents: runnerUp.amountCents,
          orgName: org.displayName,
          orgSlug: org.slug,
          orgPlanId: org.planId,
          orgRecipientId: org.gatewayRecipientId,
        });
        if (ok) {
          await prisma.auditLog.create({
            data: { organizationId: lot.organizationId, action: "auction.reoffered", entity: "Lot", entityId: lot.id, diff: { toDonorId: runnerUp.donorId, bidCents: runnerUp.amountCents } },
          });
          reoffered++;
          continue;
        }
      }
    }

    await prisma.lot.update({
      where: { id: lot.id },
      data: { status: "UNSOLD", donationId: null, winnerDonorId: null, winningBidCents: null },
    });
    await prisma.auditLog.create({
      data: { organizationId: lot.organizationId, action: "auction.unpaid_abandoned", entity: "Lot", entityId: lot.id, diff: { lastDonationId: d.id } },
    });
    console.warn(`auction: lot ${lot.id} unpaid and no eligible runner-up → UNSOLD`);
    abandoned++;
  }

  return { reminded, reoffered, abandoned };
}
