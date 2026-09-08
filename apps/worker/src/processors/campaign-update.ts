import { prisma } from "@donation/db";
import { sendEmail, campaignUpdateEmail } from "@donation/emails";
import { orgOrigin } from "../urls";

/**
 * E-mail a campaign "Novidade" to every donor who has a PAID donation to that
 * campaign and hasn't opted out of e-mail. Deduped per (donor, update) via the
 * EmailLog unique (donorId, kind).
 */
export async function sendCampaignUpdateEmails(campaignUpdateId: string): Promise<{ sent: number }> {
  const update = await prisma.campaignUpdate.findUnique({
    where: { id: campaignUpdateId },
    select: {
      title: true,
      body: true,
      campaignId: true,
      organizationId: true,
      campaign: {
        select: { title: true, slug: true, organization: { select: { slug: true, displayName: true } } },
      },
    },
  });
  if (!update) return { sent: 0 };

  const campaignUrl = `${orgOrigin(update.campaign.organization.slug)}/${update.campaign.slug}`;
  const kind = `campaign-update:${campaignUpdateId}`;

  const donors = await prisma.donor.findMany({
    where: {
      organizationId: update.organizationId,
      donations: { some: { status: "PAID", campaignId: update.campaignId } },
    },
    select: { id: true, name: true, email: true, consent: true },
  });

  let sent = 0;
  for (const d of donors) {
    const consent = (d.consent ?? {}) as { email?: boolean };
    if (consent.email === false) continue;
    try {
      await prisma.emailLog.create({ data: { organizationId: update.organizationId, donorId: d.id, kind } });
    } catch {
      continue; // already sent to this donor
    }
    await sendEmail(
      d.email,
      campaignUpdateEmail({
        donorName: d.name,
        orgName: update.campaign.organization.displayName,
        campaignTitle: update.campaign.title,
        title: update.title,
        bodyHtml: update.body,
        campaignUrl,
      }),
    );
    sent++;
  }

  await prisma.campaignUpdate.update({ where: { id: campaignUpdateId }, data: { notifiedAt: new Date() } });
  return { sent };
}
