import { NextResponse } from "next/server";
import { prisma } from "@donation/db";
import { ForbiddenError, isAppError } from "@donation/shared";
import { enqueueGatewayEvent } from "@/server/queue";
import { getOrgGateway } from "@/server/payments/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Per-organization Pagar.me webhook (BYOG). Each connected org gets its own URL
 * `/api/webhooks/pagarme/{orgId}` with its own auth secret. Same tiny contract as
 * the platform webhook: verify, persist idempotently, enqueue, 200 fast.
 */
export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const raw = await req.text();

  let gateway;
  try {
    gateway = (await getOrgGateway(orgId)).gateway;
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "not_connected" }, { status: 404 });
    console.error(`pagarme webhook[${orgId}]: resolve failed`, err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }

  let event;
  try {
    event = gateway.verifyWebhook(raw, req.headers);
  } catch (err) {
    console.warn(`pagarme webhook[${orgId}]: bad signature`, err);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Connectivity check fired by the panel's "Testar webhook" button: auth already
  // passed above, so a 200 here proves the URL is reachable and the credentials
  // match. Nothing is persisted or enqueued.
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
    console.error(`pagarme webhook[${orgId}]: unexpected error`, err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
