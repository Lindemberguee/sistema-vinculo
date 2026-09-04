import { NextResponse } from "next/server";
import { prisma } from "@donation/db";
import { ForbiddenError, isAppError } from "@donation/shared";
import { enqueueGatewayEvent } from "@/server/queue";
import { getOrgGateway } from "@/server/payments/resolve";

// Must read the raw body for signature verification — force Node runtime, no caching.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Legacy platform-wide Pagar.me webhook receiver.
 *
 * - The former MANAGED/platform account path is permanently disabled.
 * - BYOG deploy: the modern URL is
 *   `/api/webhooks/pagarme/{orgId}`, but providers already pointed at this path
 *   still work — we resolve the organization from the event payload and verify
 *   with that org's own secret.
 *
 * Either way the job is tiny: verify → persist idempotently → enqueue → 200 fast.
 * All business logic lives in the worker.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  // Any legacy global credential is enough to indicate an old deployment;
  // fail closed instead of silently accepting an incompletely configured path.
  const platformConfigured = Boolean(process.env.PAGARME_SECRET_KEY || process.env.PAGARME_WEBHOOK_SECRET);
  if (platformConfigured) {
    return NextResponse.json(
      { error: "managed_disabled", message: "O webhook global foi descontinuado. Configure a URL por organização." },
      { status: 410 },
    );
  }

  // BYOG: figure out which org this event belongs to, then verify with its secret.
  let payload: { data?: Record<string, unknown> } | null;
  try {
    payload = JSON.parse(raw) as { data?: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const orgId = await orgIdFromPayload(payload?.data ?? {});
  if (!orgId) {
    console.warn("pagarme webhook: could not map event to an org — use /api/webhooks/pagarme/{orgId}");
    return NextResponse.json(
      { error: "not_configured", message: "Use a URL por organização: /api/webhooks/pagarme/{orgId}" },
      { status: 404 },
    );
  }

  let gateway;
  try {
    gateway = (await getOrgGateway(orgId)).gateway;
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "not_connected" }, { status: 404 });
    console.error(`pagarme webhook: resolve failed for org ${orgId}`, err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }

  let event;
  try {
    event = gateway.verifyWebhook(raw, req.headers);
  } catch (err) {
    console.warn(`pagarme webhook: bad signature (org ${orgId})`, err);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Connectivity check fired by the panel's "Testar webhook" button.
  if (event.type === "ping") {
    return NextResponse.json({ ok: true, pong: true });
  }

  try {
    const created = await prisma.gatewayEvent.createMany({
      data: [{ id: event.id, type: event.type, payload: event.data as object }],
      skipDuplicates: true,
    });

    // A previous delivery may have committed the inbox row but failed before
    // publishing to Redis. Re-enqueue duplicates; BullMQ's jobId keeps this
    // idempotent while recovering the lost hand-off.
    if (created.count === 0) {
      await enqueueGatewayEvent({ gatewayEventId: event.id });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    await enqueueGatewayEvent({ gatewayEventId: event.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isAppError(err)) return NextResponse.json({ error: err.code }, { status: err.httpStatus });
    console.error("pagarme webhook: unexpected error", err);
    // 500 → Pagar.me retries.
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

/** Best-effort: map a Pagar.me v5 event payload to the organization it concerns. */
async function orgIdFromPayload(data: Record<string, unknown>): Promise<string | null> {
  const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
  const id = str(data.id);
  const nested = (data.order ?? data.charge ?? data.subscription) as Record<string, unknown> | undefined;
  const charges = data.charges as Array<Record<string, unknown>> | undefined;

  const orderId = str((data.order as Record<string, unknown>)?.id) ?? (id?.startsWith("or_") ? id : undefined);
  const chargeId =
    str((data.charge as Record<string, unknown>)?.id) ??
    str(charges?.[0]?.id) ??
    (id?.startsWith("ch_") ? id : undefined);
  const subId =
    str(data.subscription_id) ??
    str((data.subscription as Record<string, unknown>)?.id) ??
    (id?.startsWith("sub_") ? id : undefined);
  // We set `code = donationId` when creating orders.
  const code = str(data.code) ?? str(nested?.code);

  if (chargeId) {
    const d = await prisma.donation.findUnique({ where: { gatewayChargeId: chargeId }, select: { organizationId: true } });
    if (d) return d.organizationId;
  }
  if (orderId) {
    const d = await prisma.donation.findUnique({ where: { gatewayOrderId: orderId }, select: { organizationId: true } });
    if (d) return d.organizationId;
  }
  if (code) {
    const d = await prisma.donation.findUnique({ where: { id: code }, select: { organizationId: true } });
    if (d) return d.organizationId;
  }
  if (subId) {
    const p = await prisma.recurringPlan.findFirst({
      where: { gatewaySubscriptionId: subId },
      select: { organizationId: true },
    });
    if (p) return p.organizationId;
  }
  return null;
}
