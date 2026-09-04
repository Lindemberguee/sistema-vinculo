import { prisma, renderOrgEmail, resolveOrgSender } from "@donation/db";
import { sendEmail } from "@donation/emails";

const APP_BASE = process.env.APP_BASE_DOMAIN ?? "localhost:3000";
const scheme = APP_BASE.includes("localhost") ? "http" : "https";

/** Send a freshly created ambassador their public share link + private manage link. */
export async function sendAmbassadorWelcome(ambassadorId: string): Promise<{ sent: boolean }> {
  const amb = await prisma.campaignAmbassador.findUnique({
    where: { id: ambassadorId },
    select: {
      name: true,
      email: true,
      slug: true,
      manageToken: true,
      campaign: {
        select: {
          title: true,
          organizationId: true,
          organization: { select: { slug: true, displayName: true } },
        },
      },
    },
  });
  if (!amb) return { sent: false };

  const orgId = amb.campaign.organizationId;
  const origin = `${scheme}://${amb.campaign.organization.slug}.${APP_BASE}`;

  const [sender, email] = await Promise.all([
    resolveOrgSender(orgId),
    renderOrgEmail(orgId, "AMBASSADOR_WELCOME", {
      NOME: amb.name.trim().split(/\s+/)[0] || amb.name,
      ORGANIZACAO: amb.campaign.organization.displayName,
      CAMPANHA: amb.campaign.title,
      LINK: `${origin}/embaixador/${amb.slug}`,
      GERENCIAR: `${origin}/embaixador/gerir/${amb.manageToken}`,
    }),
  ]);
  await sendEmail(amb.email, email, { from: sender.from, replyTo: sender.replyTo });
  return { sent: true };
}
