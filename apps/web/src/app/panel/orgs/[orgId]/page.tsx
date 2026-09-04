import Link from "next/link";
import { Megaphone, Users, Download, Settings } from "lucide-react";
import { formatBRL } from "@donation/shared";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { getDashboard } from "@/server/crm/queries";
import { getOnboardingSteps } from "@/server/onboarding/checklist";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { Stat, Card, CardBody } from "@/components/ui";

const RANGE_DAYS = { "7": 7, "30": 30, "90": 90 } as const;
type RangeKey = keyof typeof RANGE_DAYS;

export default async function OrgDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  const { membership } = await requireOrgAccessPage(orgId, "VIEWER");

  const rangeKey = ((Array.isArray(sp.range) ? sp.range[0] : sp.range) ?? "30") as RangeKey;
  const days = RANGE_DAYS[rangeKey] ?? 30;
  const [d, onboarding] = await Promise.all([getDashboard(orgId, days), getOnboardingSteps(orgId)]);

  const firstName = membership.displayName.trim().split(/\s+/)[0];
  const composed = d.recurringRaisedCents + d.oneOffRaisedCents;
  const recPct = composed ? (d.recurringRaisedCents / composed) * 100 : 0;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {firstName}</h1>
          <p className="mt-1 text-sm text-muted">
            Este é o resumo da sua operação nos últimos {days} dias.
          </p>
        </div>
        <div role="group" aria-label="Período" className="flex gap-1 rounded-full border border-line bg-surface p-0.5">
          {(Object.keys(RANGE_DAYS) as RangeKey[]).map((r) => (
            <Link
              key={r}
              href={`/orgs/${orgId}?range=${r}`}
              aria-current={r === rangeKey ? "page" : undefined}
              className={
                "inline-flex min-h-8 items-center rounded-full px-3.5 text-xs font-medium transition-colors " +
                (r === rangeKey ? "bg-brand-600 text-white" : "text-muted hover:text-ink")
              }
            >
              {r} dias
            </Link>
          ))}
        </div>
      </header>

      <div className="space-y-6">
        <section aria-labelledby="dash-kpis">
          <h2 id="dash-kpis" className="eyebrow mb-2.5">
            Indicadores
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Arrecadado"
              value={formatBRL(d.raisedCents)}
              deltaPct={d.delta.raisedCents}
              sub="vs. período anterior"
              spark={d.series}
            />
            <Stat
              label="Doações pagas"
              value={d.paidCount}
              dot="accent"
              deltaPct={d.delta.paidCount}
              sub="vs. período anterior"
            />
            <Stat
              label="Ticket médio"
              value={formatBRL(d.avgTicketCents)}
              dot="neutral"
              deltaPct={d.delta.avgTicketCents}
              sub="vs. período anterior"
            />
            <Stat
              label="Doadores únicos"
              value={d.uniqueDonors}
              dot="success"
              deltaPct={d.delta.uniqueDonors}
              sub={`${d.newDonors} novos`}
            />
          </div>
          <p className="mt-3 text-xs text-muted">
            Comparando {d.rangeLabel} com o período anterior, {d.prevRangeLabel}.
          </p>
        </section>

        <OnboardingChecklist steps={onboarding} orgId={orgId} />

        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardBody>
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">Composição do período</h2>
                <span className="text-xs text-muted">{formatBRL(composed)} arrecadados</span>
              </div>
              {composed > 0 ? (
                <>
                  <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-canvas">
                    <div className="bg-brand-500" style={{ width: `${recPct}%` }} />
                    <div className="bg-accent-400" style={{ width: `${100 - recPct}%` }} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="flex items-center gap-1.5 text-xs text-muted">
                        <span className="size-1.5 rounded-full bg-brand-500" /> Recorrente
                      </dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">{formatBRL(d.recurringRaisedCents)}</dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1.5 text-xs text-muted">
                        <span className="size-1.5 rounded-full bg-accent-400" /> Avulso
                      </dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">{formatBRL(d.oneOffRaisedCents)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-muted">
                    {d.recurringActive} doadores recorrentes ativos · {Math.round(d.recurringShare * 100)}% das doações
                    pagas
                  </p>
                </>
              ) : (
                <p className="mt-4 text-sm text-muted">Nenhuma doação paga no período.</p>
              )}
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardBody>
              <h2 className="text-sm font-semibold">Funil no período</h2>
              <dl className="mt-3 space-y-2 text-sm">
                {(
                  [
                    ["Criadas", d.funnel.created + d.funnel.pending + d.funnel.paid + d.funnel.failedOrExpired],
                    ["Pendentes", d.funnel.pending],
                    ["Pagas", d.funnel.paid],
                    ["Falha / expirada", d.funnel.failedOrExpired],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-medium tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold">Campanhas por arrecadação</h2>
            {d.topCampaigns.length > 0 ? (
              <ul className="mt-3 space-y-2.5">
                {d.topCampaigns.map((c) => {
                  const top = d.topCampaigns[0]?.raisedCents || 1;
                  return (
                    <li key={c.title} className="grid gap-1">
                      <div className="flex items-baseline justify-between gap-4 text-sm">
                        <span className="truncate">{c.title}</span>
                        <span className="shrink-0 tabular-nums text-muted">{formatBRL(c.raisedCents)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${Math.max(2, (c.raisedCents / top) * 100)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">Nenhuma campanha ainda.</p>
            )}
          </CardBody>
        </Card>

        <section aria-labelledby="dash-actions">
          <h2 id="dash-actions" className="eyebrow mb-2.5">
            Ações rápidas
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { href: `/orgs/${orgId}/campaigns`, label: "Nova campanha", icon: Megaphone },
                { href: `/orgs/${orgId}/donors`, label: "Ver doadores", icon: Users },
                { href: `/orgs/${orgId}/exports`, label: "Exportar dados", icon: Download },
                { href: `/orgs/${orgId}/settings`, label: "Configurações", icon: Settings },
              ] as const
            ).map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.label}
                  href={a.href}
                  className="card flex items-center gap-3 p-4 text-sm font-medium transition-colors hover:border-line-strong"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                    <Icon className="size-4" />
                  </span>
                  {a.label}
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
