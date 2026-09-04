import { Queue } from "bullmq";
import { prisma } from "@donation/db";
import type { WebhookEventName } from "@donation/shared";
import { connection, QUEUE_NAMES } from "./queues";

const deliveryQueue = new Queue(QUEUE_NAMES.webhookDelivery, {
  connection,
  defaultJobOptions: { attempts: 6, backoff: { type: "exponential", delay: 10_000 }, removeOnComplete: 1_000 },
});

/**
 * Fan an outbound event to every active webhook the org has subscribed to it.
 * Creates a WebhookDelivery row per endpoint and queues its delivery.
 */
export async function emitEvent(
  organizationId: string,
  event: WebhookEventName,
  data: Record<string, unknown>,
): Promise<void> {
  const hooks = await prisma.outboundWebhook.findMany({
    where: { organizationId, active: true, events: { has: event } },
    select: { id: true },
  });
  if (hooks.length === 0) return;

  for (const hook of hooks) {
    const delivery = await prisma.webhookDelivery.create({
      data: { webhookId: hook.id, organizationId, event, payload: data as object, status: "PENDING" },
      select: { id: true },
    });
    await deliveryQueue.add("deliver", { deliveryId: delivery.id }, { jobId: `wd-${delivery.id}` });
  }
}
