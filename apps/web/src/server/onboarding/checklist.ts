import "server-only";
import { tenantPrisma, withDbRetry } from "@donation/db";

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
}

/**
 * "Primeiros passos" — the getting-started checklist shown on the dashboard.
 * Every flag is derived from real org data so it can't drift out of sync.
 */
export async function getOnboardingSteps(orgId: string): Promise<OnboardingStep[]> {
  const db = tenantPrisma(orgId);
  const base = `/orgs/${orgId}`;

  const [org, kyc, campaignCount, publishedCount, paidCount, recurringCount, memberCount, verifiedDomain] =
    await withDbRetry(() =>
      Promise.all([
        db.organization.findFirst({ where: { id: orgId }, select: { status: true, branding: true } }),
        db.organizationKyc.findFirst({ where: { organizationId: orgId }, select: { bankAccount: true } }),
        db.campaign.count(),
        db.campaign.count({ where: { status: "PUBLISHED" } }),
        db.donation.count({ where: { status: "PAID" } }),
        db.recurringPlan.count(),
        db.membership.count(),
        db.customDomain.count({ where: { verifiedAt: { not: null } } }),
      ]),
    );

  const branding = (org?.branding ?? {}) as { logoUrl?: string };
  const hasBank = !!(kyc?.bankAccount && Object.keys(kyc.bankAccount as object).length > 0);

  return [
    {
      id: "profile",
      label: "Perfil da organização",
      description: "Logo, descrição e dados de contato aparecem em todas as suas páginas de doação.",
      href: `${base}/settings`,
      done: !!branding.logoUrl,
    },
    {
      id: "recipient",
      label: "Conta de recebimento",
      description: "Cadastre os dados bancários para onde o repasse das doações será enviado.",
      href: `${base}/settings`,
      done: hasBank,
    },
    {
      id: "verification",
      label: "Verificação da ONG",
      description: "Enviamos seus documentos para análise. Campanhas só recebem doações após a aprovação.",
      href: `${base}/settings`,
      done: org?.status === "ACTIVE",
    },
    {
      id: "first-campaign",
      label: "Primeira campanha",
      description: "Crie uma campanha para começar a montar sua página de doação.",
      href: `${base}/campaigns/new`,
      done: campaignCount > 0,
    },
    {
      id: "publish-campaign",
      label: "Publicar a campanha",
      description: "Deixe a página no ar para que os doadores possam acessá-la.",
      href: `${base}/campaigns`,
      done: publishedCount > 0,
    },
    {
      id: "first-donation",
      label: "Primeira doação",
      description: "Faça uma doação de teste para ver o fluxo completo funcionando.",
      href: `${base}/campaigns`,
      done: paidCount > 0,
    },
    {
      id: "recurring",
      label: "Doação recorrente",
      description: "Ative a recorrência nas campanhas para receber doações mensais.",
      href: `${base}/campaigns`,
      done: recurringCount > 0,
    },
    {
      id: "team",
      label: "Convidar o time",
      description: "Adicione outras pessoas da organização com os papéis certos.",
      href: `${base}/settings`,
      done: memberCount > 1,
    },
    {
      id: "domain",
      label: "Domínio próprio",
      description: "Use seu próprio endereço (ex.: doe.suaong.org.br) nas páginas.",
      href: `${base}/domains`,
      done: verifiedDomain > 0,
    },
  ];
}
