import { prisma, renderOrgEmail, resolveOrgSender } from "@donation/db";
import { sendEmail } from "@donation/emails";
import { orgOrigin } from "../urls";

const LOOKAHEAD_HOURS = 30;

/**
 * Day-before reminder: for every PUBLISHED event starting in the next ~30h, e-mail
 * each donor holding a VALID ticket. Sent at most once per event (AuditLog guard),
 * so it's safe to run on a daily cron.
 */
export async function sendEventReminders(): Promise<{ events: number; emails: number }> {
  const now = new Date();
  const soon = new Date(now.getTime() + LOOKAHEAD_HOURS * 3_600_000);

  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED", startsAt: { gte: now, lte: soon } },
    select: {
      id: true,
      organizationId: true,
      title: true,
      venue: true,
      address: true,
      startsAt: true,
      organization: { select: { displayName: true, slug: true } },
    },
  });

  let emails = 0;

  for (const ev of events) {
    const already = await prisma.auditLog.findFirst({
      where: { entity: "Event", entityId: ev.id, action: "event.reminder_sent" },
      select: { id: true },
    });
    if (already) continue;

    // Newest first so each donor's most recent order is the one we link to.
    const tickets = await prisma.eventTicket.findMany({
      where: { eventId: ev.id, status: "VALID", donorId: { not: null }, donationId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { donorId: true, donationId: true },
    });

    const byDonor = new Map<string, string>(); // donorId -> donationId
    for (const t of tickets) {
      if (t.donorId && t.donationId && !byDonor.has(t.donorId)) byDonor.set(t.donorId, t.donationId);
    }
    if (byDonor.size === 0) {
      await markSent(ev.id, ev.organizationId, 0);
      continue;
    }

    const [donors, sender] = await Promise.all([
      prisma.donor.findMany({
        where: { id: { in: [...byDonor.keys()] } },
        select: { id: true, name: true, email: true },
      }),
      resolveOrgSender(ev.organizationId),
    ]);

    for (const d of donors) {
      const donationId = byDonor.get(d.id)!;
      try {
        const email = await renderOrgEmail(ev.organizationId, "EVENT_REMINDER", {
          NOME: d.name.trim().split(/\s+/)[0] || d.name,
          ORGANIZACAO: ev.organization.displayName,
          EVENTO: ev.title,
          LOCAL: ev.address ? `${ev.venue} — ${ev.address}` : ev.venue,
          DATA: ev.startsAt.toLocaleString("pt-BR"),
          LINK: `${orgOrigin(ev.organization.slug)}/e/pedido/${donationId}`,
        });
        await sendEmail(d.email, email, { from: sender.from, replyTo: sender.replyTo });
        emails++;
      } catch (e) {
        console.error(`event reminder failed for ${d.email}:`, e instanceof Error ? e.message : e);
      }
    }

    await markSent(ev.id, ev.organizationId, donors.length);
  }

  return { events: events.length, emails };
}

function markSent(eventId: string, organizationId: string, recipients: number) {
  return prisma.auditLog.create({
    data: {
      organizationId,
      action: "event.reminder_sent",
      entity: "Event",
      entityId: eventId,
      diff: { recipients },
    },
  });
}
