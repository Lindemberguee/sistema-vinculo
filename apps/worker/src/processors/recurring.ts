import {
  prisma,
  releaseSponseeForPlan,
  renderOrgEmail,
  resolveOrgGateway,
  resolveOrgSender,
  type ResolvedOrgGateway,
} from "@donation/db";
import { addInterval, formatBRL } from "@donation/shared";
import { buildSplit, calculateFees, PLATFORM_RECIPIENT_ID } from "@donation/payments";
import { sendEmail } from "@donation/emails";
import { manageUrl } from "../donations";

const nm = (n: string) => n.trim().split(/\s+/)[0] || n;

const MAX_PIX_ATTEMPTS = 3;
const DEDUPE_WINDOW_MS = 3 * 86_400_000;

/**
 * Daily Pix recurrence run: for every Pix plan whose cycle is due, generate a
 * fresh QR Code and e-mail the donor a pay link. Pagar.me can't auto-debit Pix,
 * so payment confirmation still comes through the normal `charge.paid` webhook,
 * which advances the plan (see markChargePaid).
 */
export async function runPixRecurring(): Promise<{ due: number; charged: number; canceled: number }> {
  const now = Date.now();

  const gateways = new Map<string, ResolvedOrgGateway | null>();
  async function gatewayFor(orgId: string): Promise<ResolvedOrgGateway | null> {
    if (gateways.has(orgId)) return gateways.get(orgId)!;
    let g: ResolvedOrgGateway | null = null;
    try {
      g = await resolveOrgGateway(orgId);
    } catch {
      /* org not connected — skip */
    }
    gateways.set(orgId, g);
    return g;
  }

  const plans = await prisma.recurringPlan.findMany({
    where: { method: "PIX", status: { in: ["ACTIVE", "PAST_DUE"] }, nextChargeAt: { lte: new Date(now) } },
    include: {
      donor: { select: { name: true, email: true } },
      organization: { select: { displayName: true, status: true, gatewayRecipientId: true, planId: true } },
      donations: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, createdAt: true } },
    },
    take: 200,
  });

  let charged = 0;
  let canceled = 0;

  for (const plan of plans) {
    if (plan.organization.status !== "ACTIVE") continue;
    const resolved = await gatewayFor(plan.organizationId);
    if (!resolved) continue;

    const last = plan.donations[0];

    // A recent still-open charge — leave it alone.
    if (last && last.status === "PENDING" && now - last.createdAt.getTime() < DEDUPE_WINDOW_MS) continue;

    // Previous cycle went unpaid → count a strike.
    let attempts = plan.failedAttempts;
    if (last && (last.status === "EXPIRED" || last.status === "FAILED")) attempts += 1;

    if (attempts >= MAX_PIX_ATTEMPTS) {
      await prisma.recurringPlan.update({
        where: { id: plan.id },
        data: { status: "CANCELED", canceledAt: new Date(), failedAttempts: attempts },
      });
      await releaseSponseeForPlan(prisma, plan.id);
      const [sender, email] = await Promise.all([
        resolveOrgSender(plan.organizationId),
        renderOrgEmail(plan.organizationId, "SUBSCRIPTION_CANCELED", { NOME: nm(plan.donor.name) }),
      ]);
      await sendEmail(plan.donor.email, email, { from: sender.from, replyTo: sender.replyTo });
      canceled++;
      continue;
    }

    const feeCfg = await prisma.plan.findUniqueOrThrow({
      where: { id: plan.organization.planId },
      select: { platformFeeBps: true, platformFeeFixedCents: true },
    });
    const fees = calculateFees({
      amountCents: plan.amountCents,
      tipCents: plan.tipCents,
      config: { platformFeeBps: feeCfg.platformFeeBps, platformFeeFixedCents: feeCfg.platformFeeFixedCents },
    });

    try {
      const order = await resolved.gateway.createOrder({
        donationId: `${plan.id}-${now}`,
        method: "PIX",
        chargeTotalCents: fees.chargeTotalCents,
        split:
          resolved.mode === "MANAGED" && plan.organization.gatewayRecipientId
            ? buildSplit({
                breakdown: fees,
                orgRecipientId: plan.organization.gatewayRecipientId,
                platformRecipientId: PLATFORM_RECIPIENT_ID(),
              })
            : [],
        customer: { name: plan.donor.name, email: plan.donor.email },
        expiresInSeconds: 3 * 86_400,
        metadata: { recurringPlanId: plan.id, source: "pix-recurring" },
      });

      await prisma.donation.create({
        data: {
          organizationId: plan.organizationId,
          campaignId: plan.campaignId,
          donorId: plan.donorId,
          recurringPlanId: plan.id,
          amountCents: plan.amountCents,
          tipCents: plan.tipCents,
          platformFeeCents: fees.platformFeeCents,
          netToOrgCents: fees.netToOrgCents,
          method: "PIX",
          status: "PENDING",
          gatewayOrderId: order.gatewayOrderId,
          gatewayChargeId: order.gatewayChargeId,
          paymentDetails: order.pix ?? undefined,
          metadata: { source: "pix-recurring" },
        },
      });

      await prisma.recurringPlan.update({
        where: { id: plan.id },
        data: {
          failedAttempts: attempts,
          lastAttemptAt: new Date(),
          // give the donor the window to pay before the next run reconsiders
          nextChargeAt: addInterval(new Date(), plan.interval),
        },
      });

      if (order.pix?.qrCodeUrl) {
        const [sender, email] = await Promise.all([
          resolveOrgSender(plan.organizationId),
          renderOrgEmail(plan.organizationId, "PIX_INSTRUCTIONS", {
            NOME: nm(plan.donor.name),
            VALOR: formatBRL(fees.chargeTotalCents),
            LINK: manageUrl(plan.cancelToken),
            QR: order.pix.qrCodeUrl,
          }),
        ]);
        await sendEmail(plan.donor.email, email, { from: sender.from, replyTo: sender.replyTo });
      }
      charged++;
    } catch (err) {
      console.error(`pix-recurring: plan ${plan.id} failed:`, err instanceof Error ? err.message : err);
    }
  }

  return { due: plans.length, charged, canceled };
}
