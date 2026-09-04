import { Queue, Worker } from "bullmq";
import { connection, QUEUE_NAMES } from "./queues";
import { processGatewayEvent } from "./processors/gateway-event";
import { processExport } from "./processors/export";
import { recomputeRfm } from "./processors/rfm";
import { reconcilePendingDonations } from "./processors/reconcile";
import { runPixRecurring } from "./processors/recurring";
import { runLifecycleEmails } from "./processors/lifecycle";
import { deliverWebhook } from "./processors/webhook-delivery";
import { chaseUnpaidLots, settleEndedLots } from "./processors/auction";
import { sendEventReminders } from "./processors/event-reminders";
import { closeRafflesPastDraw } from "./processors/raffle-close";
import { sendRaffleResultEmails } from "./processors/raffle-result";
import { runEmailAutomations } from "./processors/email-automations";
import { sendCampaignUpdateEmails } from "./processors/campaign-update";
import { sendAmbassadorWelcome } from "./processors/ambassador-welcome";
import { dispatchScheduledBroadcasts, sendDonorBroadcast } from "./processors/broadcast";
import { runAnnualStatements } from "./processors/annual-statements";
import { runSegmentAutomations } from "./processors/segment-automations";
import { runTeamDigests } from "./processors/team-digest";
import { runBillingSweep } from "./processors/billing-sweep";

console.log("worker: starting…");

// Longer idle poll to stay easy on metered Redis (e.g. Upstash free tier).
// Trade-off: an enqueued job can wait up to `drainDelay`s before pickup when
// the worker was idle. Lower it (or use local Redis) if that latency bites.
const IDLE_POLL_SECONDS = Number(process.env.WORKER_DRAIN_DELAY ?? 15);
const workerOpts = { connection, drainDelay: IDLE_POLL_SECONDS } as const;

// ── Webhook events ─────────────────────────────────
const gatewayEvents = new Worker(
  QUEUE_NAMES.gatewayEvents,
  async (job) => {
    const { gatewayEventId } = job.data as { gatewayEventId: string };
    await processGatewayEvent(gatewayEventId);
  },
  { ...workerOpts, concurrency: 5 },
);

// ── CSV exports ────────────────────────────────────
const reports = new Worker(
  QUEUE_NAMES.reports,
  async (job) => {
    if (job.name === "export") {
      const { exportId } = job.data as { exportId: string };
      await processExport(exportId);
    }
  },
  { ...workerOpts, concurrency: 2 },
);

// ── Scheduled maintenance (RFM, reconciliation) ────
const maintenance = new Worker(
  QUEUE_NAMES.maintenance,
  async (job) => {
    if (job.name === "rfm") {
      const { organizationId } = (job.data ?? {}) as { organizationId?: string };
      const r = await recomputeRfm(organizationId);
      console.log(`rfm: ${r.donors} donors across ${r.orgs} orgs`);
    } else if (job.name === "reconcile") {
      const r = await reconcilePendingDonations();
      console.log(`reconcile: checked ${r.checked}, updated ${r.updated}`);
    } else if (job.name === "pix-recurring") {
      const r = await runPixRecurring();
      console.log(`pix-recurring: ${r.due} due, ${r.charged} charged, ${r.canceled} canceled`);
    } else if (job.name === "lifecycle") {
      const r = await runLifecycleEmails();
      console.log(`lifecycle: ${r.winback} winback emails`);
    } else if (job.name === "settle-lots") {
      const r = await settleEndedLots();
      const c = await chaseUnpaidLots();
      console.log(
        `settle-lots: ${r.settled} closed, ${r.sold} sold · chase: ${c.reminded} reminded, ${c.reoffered} re-offered, ${c.abandoned} abandoned`,
      );
    } else if (job.name === "event-reminders") {
      const r = await sendEventReminders();
      console.log(`event-reminders: ${r.emails} e-mails across ${r.events} events`);
    } else if (job.name === "raffle-close") {
      const r = await closeRafflesPastDraw();
      if (r.closed) console.log(`raffle-close: ${r.closed} raffle(s) closed`);
    } else if (job.name === "email-automations") {
      const r = await runEmailAutomations();
      console.log(`email-automations: ${r.welcome} welcome, ${r.birthday} birthday, ${r.recurring} recurring`);
    } else if (job.name === "broadcast-dispatch") {
      const r = await dispatchScheduledBroadcasts();
      if (r.dispatched) console.log(`broadcast-dispatch: ${r.dispatched} scheduled broadcast(s) sent to the queue`);
    } else if (job.name === "annual-statements") {
      const { year } = (job.data ?? {}) as { year?: number };
      const y = year ?? new Date().getFullYear() - 1;
      const r = await runAnnualStatements(y);
      console.log(`annual-statements ${y}: ${r.sent} e-mails across ${r.orgs} org(s)`);
    } else if (job.name === "segment-automations") {
      const r = await runSegmentAutomations();
      if (r.sent) console.log(`segment-automations: ${r.sent} e-mails · ${r.segments} segment(s) reconciled`);
    } else if (job.name === "team-digest") {
      const r = await runTeamDigests(new Date().getHours());
      if (r.sent) console.log(`team-digest: ${r.sent} e-mails to ${r.orgs} org team(s)`);
    } else if (job.name === "billing-sweep") {
      const r = await runBillingSweep();
      if (r.pastDue || r.suspended) console.log(`billing-sweep: ${r.pastDue} past-due, ${r.suspended} suspended`);
    }
  },
  { ...workerOpts, concurrency: 1 },
);

// ── Outbound webhook delivery ──────────────────────
const webhookDelivery = new Worker(
  QUEUE_NAMES.webhookDelivery,
  async (job) => {
    const { deliveryId } = job.data as { deliveryId: string };
    await deliverWebhook(deliveryId);
  },
  { ...workerOpts, concurrency: 10 },
);

// ── E-mails (fan-outs) ─────────────────────────────
const emails = new Worker(
  QUEUE_NAMES.emails,
  async (job) => {
    if (job.name === "campaign-update") {
      const { campaignUpdateId } = job.data as { campaignUpdateId: string };
      const r = await sendCampaignUpdateEmails(campaignUpdateId);
      console.log(`campaign-update ${campaignUpdateId}: ${r.sent} e-mails`);
    } else if (job.name === "ambassador-welcome") {
      const { ambassadorId } = job.data as { ambassadorId: string };
      await sendAmbassadorWelcome(ambassadorId);
    } else if (job.name === "raffle-result") {
      const { raffleId } = job.data as { raffleId: string };
      const r = await sendRaffleResultEmails(raffleId);
      console.log(`raffle-result ${raffleId}: ${r.sent} e-mails`);
    } else if (job.name === "broadcast") {
      const { broadcastId } = job.data as { broadcastId: string };
      const r = await sendDonorBroadcast(broadcastId);
      console.log(`broadcast ${broadcastId}: ${r.sent} sent, ${r.skipped} skipped`);
    }
  },
  { ...workerOpts, concurrency: 2 },
);

for (const w of [gatewayEvents, reports, maintenance, webhookDelivery, emails]) {
  w.on("failed", (job, err) => console.error(`${w.name} job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message));
}

// ── Repeatable schedules ───────────────────────────
async function registerSchedules() {
  const q = new Queue(QUEUE_NAMES.maintenance, { connection });
  // Nightly RFM recompute at 03:10, hourly reconciliation.
  await q.add("rfm", {}, { repeat: { pattern: "10 3 * * *" }, jobId: "rfm-nightly", removeOnComplete: true });
  await q.add("reconcile", {}, { repeat: { pattern: "0 * * * *" }, jobId: "reconcile-hourly", removeOnComplete: true });
  await q.add("pix-recurring", {}, { repeat: { pattern: "30 8 * * *" }, jobId: "pix-recurring-daily", removeOnComplete: true });
  await q.add("lifecycle", {}, { repeat: { pattern: "0 9 * * *" }, jobId: "lifecycle-daily", removeOnComplete: true });
  await q.add("settle-lots", {}, { repeat: { pattern: "*/5 * * * *" }, jobId: "settle-lots", removeOnComplete: true });
  await q.add("event-reminders", {}, { repeat: { pattern: "0 * * * *" }, jobId: "event-reminders-hourly", removeOnComplete: true });
  await q.add("raffle-close", {}, { repeat: { pattern: "5 * * * *" }, jobId: "raffle-close-hourly", removeOnComplete: true });
  await q.add("email-automations", {}, { repeat: { pattern: "0 10 * * *" }, jobId: "email-automations-daily", removeOnComplete: true });
  await q.add("broadcast-dispatch", {}, { repeat: { pattern: "*/5 * * * *" }, jobId: "broadcast-dispatch", removeOnComplete: true });
  // Annual giving statement — mid-January, for the year that just ended.
  await q.add("annual-statements", {}, { repeat: { pattern: "0 9 15 1 *" }, jobId: "annual-statements-jan", removeOnComplete: true });
  // Segment-entry drip rules — once a day.
  await q.add("segment-automations", {}, { repeat: { pattern: "30 10 * * *" }, jobId: "segment-automations-daily", removeOnComplete: true });
  // Team daily digest — hourly; each org fires at its own digestHour.
  await q.add("team-digest", {}, { repeat: { pattern: "7 * * * *" }, jobId: "team-digest-hourly", removeOnComplete: true });
  // Billing: mark overdue subscriptions PAST_DUE, auto-suspend after the grace window.
  await q.add("billing-sweep", {}, { repeat: { pattern: "0 6 * * *" }, jobId: "billing-sweep-daily", removeOnComplete: true });
  await q.close();
  console.log("worker: schedules registered");
}
registerSchedules().catch((e) => console.error("failed to register schedules:", e));

const shutdown = async () => {
  console.log("worker: shutting down…");
  await Promise.all([
    gatewayEvents.close(),
    reports.close(),
    maintenance.close(),
    webhookDelivery.close(),
    emails.close(),
  ]);
  await connection.quit();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
