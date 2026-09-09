import { createHmac } from "node:crypto";
import { prisma } from "@donation/db";
import { assertSafeOutboundUrl, UnsafeUrlError } from "@donation/shared";

const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 6;

/** Deliver one WebhookDelivery. Throws on failure so BullMQ retries. */
export async function deliverWebhook(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webhook: { select: { url: true, secret: true, active: true } } },
  });
  if (!delivery || delivery.status === "DELIVERED") return;
  if (!delivery.webhook.active) {
    await prisma.webhookDelivery.update({ where: { id: deliveryId }, data: { status: "FAILED", lastError: "webhook disabled" } });
    return;
  }

  // Re-check at send time: the URL passed validation at creation, but DNS could
  // have been re-pointed at a private address since. Fail terminally (no retry).
  try {
    await assertSafeOutboundUrl(delivery.webhook.url);
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { status: "FAILED", lastError: `blocked: ${err.message}` },
      });
      return;
    }
    throw err;
  }

  const body = JSON.stringify({
    id: delivery.id,
    event: delivery.event,
    createdAt: delivery.createdAt.toISOString(),
    data: delivery.payload,
  });
  const signature = createHmac("sha256", delivery.webhook.secret).update(body, "utf8").digest("hex");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let responseCode: number | undefined;
  let error: string | undefined;
  try {
    const res = await fetch(delivery.webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": delivery.event,
        "X-Webhook-Signature": `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    });
    responseCode = res.status;
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timer);
  }

  const attempts = delivery.attempts + 1;

  if (!error) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: "DELIVERED", attempts, responseCode, deliveredAt: new Date(), lastError: null },
    });
    return;
  }

  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
      attempts,
      responseCode,
      lastError: error,
    },
  });
  throw new Error(`webhook delivery ${deliveryId} failed: ${error}`);
}
