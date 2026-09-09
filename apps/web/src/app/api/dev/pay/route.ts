import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@donation/db";
import { isMockGateway } from "@donation/payments";
import { enqueueGatewayEvent } from "@/server/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DEV ONLY (`PAYMENTS_GATEWAY=mock`, non-production): simulate a gateway callback
 * for a pending charge so the whole webhook → worker pipeline runs locally
 * without Pagar.me. Body: `{ donationId | chargeId, type? }`.
 *   type: "charge.paid" (default) | "charge.refunded" | "charge.payment_failed"
 */
const bodySchema = z
  .object({
    donationId: z.string().min(1).optional(),
    chargeId: z.string().min(1).optional(),
    type: z.enum(["charge.paid", "order.paid", "charge.refunded", "charge.payment_failed"]).default("charge.paid"),
  })
  .refine((b) => b.donationId || b.chargeId, { message: "Informe donationId ou chargeId" });

export async function POST(req: Request) {
  if (!isMockGateway() || process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 422 });
  }
  const { donationId, chargeId, type } = parsed.data;

  const donation = await prisma.donation.findFirst({
    where: donationId ? { id: donationId } : { gatewayChargeId: chargeId },
    select: { id: true, gatewayChargeId: true, status: true, organizationId: true },
  });
  if (!donation) return NextResponse.json({ error: "donation_not_found" }, { status: 404 });
  if (!donation.gatewayChargeId) {
    return NextResponse.json({ error: "donation_has_no_charge" }, { status: 409 });
  }

  const status = type === "charge.refunded" ? "refunded" : type === "charge.payment_failed" ? "failed" : "paid";
  const event = {
    id: `evt_mock_${type}_${donation.gatewayChargeId}`,
    type,
    payload: { id: donation.gatewayChargeId, status } as object,
    organizationId: donation.organizationId,
  };

  const created = await prisma.gatewayEvent.createMany({ data: [event], skipDuplicates: true });
  if (created.count === 0) {
    return NextResponse.json({ ok: true, duplicate: true, chargeId: donation.gatewayChargeId, type });
  }
  await enqueueGatewayEvent({ gatewayEventId: event.id });

  return NextResponse.json({ ok: true, donationId: donation.id, chargeId: donation.gatewayChargeId, type });
}
