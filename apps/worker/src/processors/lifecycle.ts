import { prisma, renderOrgEmail, resolveOrgSender } from "@donation/db";
import { sendEmail } from "@donation/emails";

const APP_BASE = process.env.APP_BASE_DOMAIN ?? "localhost:3000";
const scheme = APP_BASE.includes("localhost") ? "http" : "https";

/**
 * Win-back sweep: donors whose last paid donation was 120–180 days ago, with no
 * active recurrence, who haven't had a win-back e-mail yet.
 */
export async function runLifecycleEmails(): Promise<{ winback: number }> {
  const now = Date.now();
  const from = new Date(now - 180 * 86_400_000);
  const to = new Date(now - 120 * 86_400_000);

  const donors = await prisma.donor.findMany({
    where: {
      donationsCount: { gt: 0 },
      lastDonationAt: { gte: from, lte: to },
      recurring: { none: { status: "ACTIVE" } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      organizationId: true,
      organization: {
        select: {
          slug: true,
          displayName: true,
          campaigns: { where: { status: "PUBLISHED" }, take: 1, orderBy: { raisedCents: "desc" }, select: { slug: true } },
        },
      },
    },
    take: 500,
  });

  const senders = new Map<string, Awaited<ReturnType<typeof resolveOrgSender>>>();
  let sent = 0;
  for (const d of donors) {
    try {
      await prisma.emailLog.create({ data: { organizationId: d.organizationId, donorId: d.id, kind: "winback" } });
    } catch {
      continue; // already sent
    }

    const camp = d.organization.campaigns[0]?.slug;
    const donateUrl = `${scheme}://${d.organization.slug}.${APP_BASE}${camp ? `/${camp}` : ""}`;

    let sender = senders.get(d.organizationId);
    if (!sender) {
      sender = await resolveOrgSender(d.organizationId);
      senders.set(d.organizationId, sender);
    }
    const email = await renderOrgEmail(d.organizationId, "WINBACK", {
      NOME: d.name.trim().split(/\s+/)[0] || d.name,
      ORGANIZACAO: d.organization.displayName,
      LINK: donateUrl,
    });
    await sendEmail(d.email, email, { from: sender.from, replyTo: sender.replyTo });
    sent++;
  }

  return { winback: sent };
}
