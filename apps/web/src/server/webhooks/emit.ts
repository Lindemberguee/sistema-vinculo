import "server-only";
import { prisma } from "@donation/db";
import type { WebhookEventName } from "@donation/shared";
import { enqueueWebhookDelivery } from "@/server/queue";

/**
 * Fan an outbound event to the org's subscribed webhooks. Same contract as the
 * worker's `emitEvent`; used for events that originate from a user action
 * (campaign published, KYC approved, recurrence canceled).
 */
export async function emitOutboundEvent(
  organizationId: string,
  event: WebhookEventName,
  data: Record<string, unknown>,
): Promise<void> {
  const hooks = await prisma.outboundWebhook.findMany({
    where: { organizationId, active: true, events: { has: event } },
    select: { id: true },
  });

  for (const hook of hooks) {
    const delivery = await prisma.webhookDelivery.create({
      data: { webhookId: hook.id, organizationId, event, payload: data as object, status: "PENDING" },
      select: { id: true },
    });
    await enqueueWebhookDelivery(delivery.id);
  }
}
