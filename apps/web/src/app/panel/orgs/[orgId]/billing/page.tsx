import { notFound } from "next/navigation";
import { prisma, getOrgLimits, MODULES, planHasModule } from "@donation/db";
import { formatBRL } from "@donation/shared";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { PlanSelector } from "@/components/OrgSettingsClient";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";

const MODULE_LABEL: Record<string, string> = {
  crm: "CRM de doadores",
  raffles: "Rifas",
  events: "Eventos",
  auctions: "Leilões",
  sponsees: "Apadrinhamento",
  links: "Links de doação",
  ambassadors: "Embaixadores",
  intl: "Doação internacional",
};

const SUB_LABEL: Record<string, { label: string; tone: "success" | "warn" | "danger" | "neutral" }> = {
  ACTIVE: { label: "Ativa", tone: "success" },
  TRIALING: { label: "Em avaliação", tone: "neutral" },
  PAST_DUE: { label: "Vencida", tone: "danger" },
  CANCELED: { label: "Cancelada", tone: "neutral" },
};

const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" });

export default async function BillingPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "OWNER");

  const [org, sub, plans, limits, campaignCount, memberCount] = await Promise.all([
    db.organization.findFirst({ where: { id: orgId }, select: { planId: true, plan: { select: { name: true, monthlyCents: true } } } }),
    prisma.subscription.findUnique({ where: { organizationId: orgId }, select: { status: true, currentPeriodEnd: true, lastPaidAt: true } }),
    prisma.plan.findMany({ where: { isPublic: true }, orderBy: { monthlyCents: "asc" }, select: { id: true, name: true, monthlyCents: true, platformFeeBps: true } }),
    getOrgLimits(orgId),
    db.campaign.count({ where: { organizationId: orgId } }),
    db.membership.count({ where: { organizationId: orgId } }),
  ]);
  if (!org) notFound();

  const s = sub ? (SUB_LABEL[sub.status] ?? { label: sub.status, tone: "neutral" as const }) : null;
  const overdueDays =
    sub?.status === "PAST_DUE" && sub.currentPeriodEnd
      ? Math.max(0, Math.floor((Date.now() - sub.currentPeriodEnd.getTime()) / 86_400_000))
      : 0;

  const quota = (used: number, max: number | null) => (max == null ? `${used} de ∞` : `${used} de ${max}`);

  return (
    <>
      <PageHeader
        title="Plano e cobrança"
        description="Seu plano, o que ele inclui e o vencimento da mensalidade."
        back={{ href: `/orgs/${orgId}/settings`, label: "Configurações" }}
      />

      <div className="grid gap-4">
        <Card>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">
                  Plano {org.plan?.name ?? org.planId}
                  {org.plan?.monthlyCents ? (
                    <span className="ml-2 text-sm font-normal text-muted">
                      {formatBRL(org.plan.monthlyCents)}/mês
                    </span>
                  ) : null}
                </h2>
              </div>
              {s && <Badge tone={s.tone}>{s.label}</Badge>}
            </div>

            {sub && (
              <p className="text-sm text-muted">
                {sub.status === "PAST_DUE"
                  ? `Mensalidade vencida há ${overdueDays} dia${overdueDays === 1 ? "" : "s"} (venceu em ${dt.format(sub.currentPeriodEnd)}). Regularize com nossa equipe para não suspender a organização.`
                  : `Próximo vencimento: ${dt.format(sub.currentPeriodEnd)}.`}
                {sub.lastPaidAt ? ` Último pagamento registrado em ${dt.format(sub.lastPaidAt)}.` : ""}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <div className="eyebrow">Campanhas</div>
                <div className="mt-0.5 text-sm font-medium tabular-nums">{quota(campaignCount, limits.maxCampaigns)}</div>
              </div>
              <div>
                <div className="eyebrow">Usuários</div>
                <div className="mt-0.5 text-sm font-medium tabular-nums">{quota(memberCount, limits.maxUsers)}</div>
              </div>
              <div>
                <div className="eyebrow">Domínio próprio</div>
                <div className="mt-0.5 text-sm font-medium">{limits.customDomain ? "Incluso" : "Não incluso"}</div>
              </div>
            </div>

            <div>
              <div className="eyebrow mb-1.5">Módulos</div>
              <div className="flex flex-wrap gap-1.5">
                {MODULES.map((m) => (
                  <span
                    key={m}
                    className={
                      planHasModule(limits, m)
                        ? "rounded-md border border-brand-600/40 bg-brand-50 px-2 py-0.5 text-xs text-brand-700"
                        : "rounded-md border border-line-strong px-2 py-0.5 text-xs text-faint line-through"
                    }
                  >
                    {MODULE_LABEL[m] ?? m}
                  </span>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        <PlanSelector orgId={orgId} currentPlanId={org.planId} plans={plans} />

        <p className="hint">
          A cobrança da mensalidade é combinada diretamente com nossa equipe (Pix ou boleto). A cobrança
          automática no cartão entra numa fase futura.
        </p>
      </div>
    </>
  );
}
