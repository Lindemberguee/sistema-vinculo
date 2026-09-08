import { Queue } from "bullmq";
import { buildDonorWhere, parseDonorFilters, prisma, resolveOrgSender, signUnsubscribe } from "@donation/db";
import { donorBroadcastEmail, sendEmail } from "@donation/emails";
import { connection, QUEUE_NAMES } from "../queues";
import { appOrigin } from "../urls";

const BATCH = 200;

/**
 * Send a one-off donor broadcast. Iterates the donors matching the filter
 * snapshot in id order, skips anyone who opted out of e-mail, and dedups per
 * donor via EmailLog's unique (donorId, kind) so a re-run never double-sends.
 */
export async function sendDonorBroadcast(broadcastId: string): Promise<{ sent: number; skipped: number }> {
  const b = await prisma.donorBroadcast.findUnique({
    where: { id: broadcastId },
    select: {
      status: true,
      organizationId: true,
      subject: true,
      bodyText: true,
      filters: true,
      organization: { select: { displayName: true } },
    },
  });
  if (!b || b.status !== "SENDING") return { sent: 0, skipped: 0 };

  const kind = `broadcast:${broadcastId}`;
  let sent = 0;
  let skipped = 0;

  try {
    const [sender, suppressedRows] = await Promise.all([
      resolveOrgSender(b.organizationId),
      prisma.donorEmailStatus.findMany({
        where: { organizationId: b.organizationId },
        select: { email: true },
      }),
    ]);
    const suppressed = new Set(suppressedRows.map((r) => r.email.toLowerCase()));

    const where = {
      ...buildDonorWhere(b.organizationId, parseDonorFilters((b.filters ?? {}) as Record<string, string>)),
      NOT: { consent: { path: ["email"], equals: false } },
    };

    let cursor: string | undefined;
    for (;;) {
      const batch = await prisma.donor.findMany({
        where,
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: { id: true, name: true, email: true },
      });
      if (batch.length === 0) break;
      cursor = batch[batch.length - 1]!.id;

      for (const d of batch) {
        // Decide this donor's outcome, then record it (per-message audit trail).
        let status: "SENT" | "SKIPPED_SUPPRESSED" | "SKIPPED_DUPLICATE" | "FAILED" = "SENT";
        let error: string | null = null;
        let sentAt: Date | null = null;

        if (suppressed.has(d.email.toLowerCase())) {
          status = "SKIPPED_SUPPRESSED";
          skipped++;
        } else {
          let deduped = false;
          try {
            await prisma.emailLog.create({ data: { organizationId: b.organizationId, donorId: d.id, kind } });
          } catch {
            deduped = true; // already sent to this donor
          }
          if (deduped) {
            status = "SKIPPED_DUPLICATE";
            skipped++;
          } else {
            const unsubUrl = `${appOrigin()}/api/u/${signUnsubscribe(b.organizationId, d.id)}`;
            try {
              await sendEmail(
                d.email,
                donorBroadcastEmail({
                  donorName: d.name,
                  orgName: b.organization.displayName,
                  subject: b.subject,
                  bodyText: b.bodyText,
                  unsubscribeUrl: unsubUrl,
                }),
                {
                  from: sender.from,
                  replyTo: sender.replyTo,
                  headers: {
                    "List-Unsubscribe": `<${unsubUrl}>`,
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                  },
                },
              );
              status = "SENT";
              sentAt = new Date();
              sent++;
            } catch (e) {
              status = "FAILED";
              error = e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300);
              skipped++;
              console.error(`broadcast ${broadcastId} → ${d.email}:`, e instanceof Error ? e.message : e);
            }
          }
        }

        await prisma.broadcastRecipient.upsert({
          where: { broadcastId_donorId: { broadcastId, donorId: d.id } },
          create: {
            broadcastId,
            organizationId: b.organizationId,
            donorId: d.id,
            email: d.email,
            status,
            error,
            sentAt,
          },
          update: { status, error, sentAt, email: d.email },
        });
      }
    }

    await prisma.donorBroadcast.update({
      where: { id: broadcastId },
      data: { status: "SENT", sentCount: sent, skippedCount: skipped, sentAt: new Date() },
    });
  } catch (err) {
    await prisma.donorBroadcast.update({
      where: { id: broadcastId },
      data: {
        status: "FAILED",
        sentCount: sent,
        skippedCount: skipped,
        error: err instanceof Error ? err.message.slice(0, 500) : String(err),
      },
    });
    throw err;
  }

  return { sent, skipped };
}

/**
 * Cron tick: promote every SCHEDULED broadcast whose fire time has passed to
 * SENDING and enqueue the fan-out. Uses a stable jobId so a double tick can't
 * enqueue the same broadcast twice; the SENDING guard in sendDonorBroadcast is
 * the second line of defence.
 */
export async function dispatchScheduledBroadcasts(): Promise<{ dispatched: number }> {
  const due = await prisma.donorBroadcast.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    take: 50,
    select: { id: true },
  });
  if (due.length === 0) return { dispatched: 0 };

  const q = new Queue(QUEUE_NAMES.emails, { connection });
  let dispatched = 0;
  try {
    for (const { id } of due) {
      const claim = await prisma.donorBroadcast.updateMany({
        where: { id, status: "SCHEDULED" },
        data: { status: "SENDING", error: null, scheduledAt: null },
      });
      if (claim.count === 0) continue; // someone else got it
      await q.add("broadcast", { broadcastId: id }, { jobId: `bc-${id}`, removeOnComplete: true });
      dispatched++;
    }
  } finally {
    await q.close();
  }
  return { dispatched };
}
