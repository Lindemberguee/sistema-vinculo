import { prisma, renderOrgEmail, resolveOrgSender } from "@donation/db";
import { sendEmail } from "@donation/emails";

const APP_BASE = process.env.APP_BASE_DOMAIN ?? "localhost:3000";
const scheme = APP_BASE.includes("localhost") ? "http" : "https";

/**
 * E-mail the draw result to every donor holding a PAID number in the raffle, so
 * they can check their own numbers against the published seed. Deduped per
 * (donor, raffle) via EmailLog's unique (donorId, kind).
 */
export async function sendRaffleResultEmails(raffleId: string): Promise<{ sent: number }> {
  const raffle = await prisma.raffle.findUnique({
    where: { id: raffleId },
    select: {
      title: true,
      status: true,
      drawnNumber: true,
      organizationId: true,
      organization: { select: { slug: true, displayName: true } },
    },
  });
  if (!raffle || raffle.status !== "DRAWN" || raffle.drawnNumber == null) return { sent: 0 };

  const resultUrl = `${scheme}://${raffle.organization.slug}.${APP_BASE}/rifa/${raffleId}`;
  const kind = `raffle-result:${raffleId}`;

  const donors = await prisma.donor.findMany({
    where: {
      organizationId: raffle.organizationId,
      // any PAID ticket in this raffle
      id: {
        in: (
          await prisma.raffleTicket.findMany({
            where: { raffleId, status: "PAID", donorId: { not: null } },
            select: { donorId: true },
            distinct: ["donorId"],
          })
        )
          .map((t) => t.donorId)
          .filter((x): x is string => Boolean(x)),
      },
    },
    select: { id: true, name: true, email: true, consent: true },
  });

  const sender = await resolveOrgSender(raffle.organizationId);

  let sent = 0;
  for (const d of donors) {
    const consent = (d.consent ?? {}) as { email?: boolean };
    if (consent.email === false) continue;
    try {
      await prisma.emailLog.create({ data: { organizationId: raffle.organizationId, donorId: d.id, kind } });
    } catch {
      continue; // already sent to this donor
    }
    const email = await renderOrgEmail(raffle.organizationId, "RAFFLE_RESULT", {
      NOME: d.name.trim().split(/\s+/)[0] || d.name,
      ORGANIZACAO: raffle.organization.displayName,
      CAMPANHA: raffle.title,
      NUMERO: String(raffle.drawnNumber),
      LINK: resultUrl,
    });
    await sendEmail(d.email, email, { from: sender.from, replyTo: sender.replyTo });
    sent++;
  }

  return { sent };
}
