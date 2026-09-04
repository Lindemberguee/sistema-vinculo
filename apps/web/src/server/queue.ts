import { Queue } from "bullmq";
import IORedis from "ioredis";

/**
 * Producer side of the job queues. The worker app (apps/worker) consumes them.
 * Keep names/payloads in sync with apps/worker/src/queues.ts.
 */
// lazyConnect so importing this module (e.g. during `next build` page collection)
// does not open a socket. The connection is established on first enqueue.
const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});
connection.on("error", (err) => console.error("[queue] redis error:", err.message));

export const QUEUE_NAMES = {
  gatewayEvents: "gateway-events",
  emails: "emails",
  recurringCharges: "recurring-charges",
  reports: "reports",
  maintenance: "maintenance",
  webhookDelivery: "webhook-delivery",
} as const;

export interface GatewayEventJob {
  gatewayEventId: string; // GatewayEvent.id — the worker re-reads the payload from the DB
}

const globalForQueues = globalThis as unknown as { __queues?: Record<string, Queue> };
globalForQueues.__queues ??= {};

function getQueue(name: string): Queue {
  return (globalForQueues.__queues![name] ??= new Queue(name, {
    connection,
    defaultJobOptions: {
      attempts: 8,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
  }));
}

export async function enqueueGatewayEvent(job: GatewayEventJob) {
  await getQueue(QUEUE_NAMES.gatewayEvents).add("process", job, { jobId: job.gatewayEventId });
}

export async function enqueueEmail(job: { template: string; to: string; data: Record<string, unknown> }) {
  await getQueue(QUEUE_NAMES.emails).add("send", job);
}

// BullMQ forbids ":" in a custom job id (it's the internal Redis key separator),
// so these dedup ids use "-".

/** Fan-out: the worker loads the update + its campaign's donors and e-mails each. */
export async function enqueueCampaignUpdate(campaignUpdateId: string) {
  await getQueue(QUEUE_NAMES.emails).add(
    "campaign-update",
    { campaignUpdateId },
    { jobId: `cu-${campaignUpdateId}` },
  );
}

/** Fan-out: send a one-off donor broadcast to everyone matching its filter. */
export async function enqueueBroadcast(broadcastId: string) {
  await getQueue(QUEUE_NAMES.emails).add("broadcast", { broadcastId }, { jobId: `bc-${broadcastId}` });
}

/** Fan-out: e-mail the draw result to everyone holding a paid number. */
export async function enqueueRaffleResult(raffleId: string) {
  await getQueue(QUEUE_NAMES.emails).add(
    "raffle-result",
    { raffleId },
    { jobId: `rr-${raffleId}` },
  );
}

/** Welcome + share/manage links for a freshly created campaign ambassador. */
export async function enqueueAmbassadorWelcome(ambassadorId: string) {
  await getQueue(QUEUE_NAMES.emails).add(
    "ambassador-welcome",
    { ambassadorId },
    { jobId: `amb-${ambassadorId}` },
  );
}

export async function enqueueExport(exportId: string) {
  await getQueue(QUEUE_NAMES.reports).add("export", { exportId }, { jobId: `export-${exportId}` });
}

/** Ad-hoc RFM recompute for one org (the nightly run covers everyone). */
export async function enqueueRfm(organizationId: string) {
  await getQueue(QUEUE_NAMES.maintenance).add(
    "rfm",
    { organizationId },
    { jobId: `rfm-${organizationId}-${Date.now()}` },
  );
}

export async function enqueueWebhookDelivery(deliveryId: string) {
  await getQueue(QUEUE_NAMES.webhookDelivery).add("deliver", { deliveryId }, { jobId: `wd-${deliveryId}` });
}

/** Manual run of the annual giving statement for a given year. */
export async function enqueueAnnualStatements(year: number) {
  await getQueue(QUEUE_NAMES.maintenance).add(
    "annual-statements",
    { year },
    { jobId: `annual-${year}-${Date.now()}` },
  );
}
