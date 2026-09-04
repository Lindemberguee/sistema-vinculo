import IORedis from "ioredis";

export const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

// Keep in sync with apps/web/src/server/queue.ts
export const QUEUE_NAMES = {
  gatewayEvents: "gateway-events",
  emails: "emails",
  recurringCharges: "recurring-charges",
  reports: "reports",
  maintenance: "maintenance",
  webhookDelivery: "webhook-delivery",
} as const;
