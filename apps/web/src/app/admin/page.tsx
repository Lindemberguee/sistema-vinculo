import Link from "next/link";
import { prisma } from "@donation/db";
import { formatBRL } from "@donation/shared";
import { requirePlatformAdminPage } from "@/server/admin-helpers";
import { PageHeader, Card, CardBody, Badge, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const dayMs = 24 * 60 * 60 * 1000;
const fmtDay = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

export default async function AdminHome() {
  await requirePlatformAdminPage();

  const now = new Date();
  const start30 = new Date(now.getTime() - 29 * dayMs);
  const previous30 = new Date(now.getTime() - 59 * dayMs);

  const [orgs, users, donations30, donationsPrev, recentDonations, pendingKyc, gatewayEvents, plans] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        displayName: true,
        slug: true,
        status: true,
        kycStatus: true,
        createdAt: true,
        plan: { select: { name: true, monthlyCents: true } },
        subscription: { select: { status: true } },
        paymentConfig: { select: { provider: true, verifiedAt: true } },
        _count: { select: { donations: true, campaigns: true, donors: true, memberships: true } },
      },
    }),
    prisma.user.count(),
    prisma.donation.findMany({
      where: { status: "PAID", paidAt: { gte: start30 } },
      select: { amountCents: true, tipCents: true, paidAt: true, organizationId: true },
    }),
    prisma.donation.findMany({
      where: { status: "PAID", paidAt: { gte: previous30, lt: start30 } },
      select: { amountCents: true, tipCents: true },
    }),
    prisma.donation.findMany({
      where: { status: "PAID" },
      orderBy: { paidAt: "desc" },
      take: 8,
      select: {
        id: true,
        amountCents: true,
        tipCents: true,
        paidAt: true,
        method: true,
        donor: { select: { name: true, email: true } },
        organization: { select: { displayName: true } },
      },
    }),
    prisma.organization.findMany({
      where: { kycStatus: { in: ["SUBMITTED", "IN_REVIEW", "REJECTED"] } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, displayName: true, kycStatus: true, status: true, updatedAt: true },
    }),
    prisma.gatewayEvent.findMany({
      orderBy: { receivedAt: "desc" },
      take: 8,
      select: { id: true, type: true, processedAt: true, error: true, attempts: true, receivedAt: true },
    }),
    prisma.plan.findMany({ select: { id: true, name: true, monthlyCents: true } }),
  ]);

  const total30 = donations30.reduce((s, d) => s + d.amountCents + d.tipCents, 0);
  const totalPrev = donationsPrev.reduce((s, d) => s + d.amountCents + d.tipCents, 0);
  const delta = totalPrev > 0 ? ((total30 - totalPrev) / totalPrev) * 100 : null;
  const activeOrgs = orgs.filter((o) => o.status === "ACTIVE").length;
  const connectedGateways = orgs.filter((o) => Boolean(o.paymentConfig?.verifiedAt)).length;
  const mrr = orgs.reduce((sum, o) => {
    const paying = o.status === "ACTIVE" && (o.subscription?.status === "ACTIVE" || o.subscription?.status === "TRIALING");
    return sum + (paying ? o.plan.monthlyCents : 0);
  }, 0);

  const revenueByDay = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(start30.getTime() + i * dayMs);
    const key = d.toISOString().slice(0, 10);
    return {
      key,
      label: fmtDay.format(d),
      value: donations30.filter((x) => x.paidAt?.toISOString().slice(0, 10) === key).reduce((s, x) => s + x.amountCents + x.tipCents, 0),
    };
  });

  const orgRevenue = orgs
    .map((org) => ({
      ...org,
      revenue30: donations30.filter((d) => d.organizationId === org.id).reduce((s, d) => s + d.amountCents + d.tipCents, 0),
    }))
    .sort((a, b) => b.revenue30 - a.revenue30)
    .slice(0, 6);

  const planCounts = plans.map((plan) => ({ ...plan, count: orgs.filter((o) => o.plan.name === plan.name).length }));

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <PageHeader
        title="Centro de controle da plataforma"
        description="Saúde comercial, operação das organizações, pagamentos e eventos críticos em uma visão só."
        actions={
          <div className="flex gap-2">
            <Link href="/admin/orgs" className="btn-secondary btn-sm no-underline">Organizações</Link>
            <Link href="/admin/users" className="btn-primary btn-sm no-underline">Usuários</Link>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Volume 30 dias" value={formatBRL(total30)} detail={delta == null ? "sem base anterior" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1).replace(".", ",")}% vs. período anterior`} />
        <Metric label="MRR estimado" value={formatBRL(mrr)} detail="planos ativos/trial" />
        <Metric label="Organizações ativas" value={`${activeOrgs}/${orgs.length}`} detail={`${connectedGateways} com gateway verificado`} />
        <Metric label="Usuários" value={users.toString()} detail={`${pendingKyc.length} KYC exigem atenção`} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardBody>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-subhead">Receita de doações</h2>
                <p className="text-sm text-muted">Últimos 30 dias por data de pagamento.</p>
              </div>
              <Badge tone="success">Stone conciliada</Badge>
            </div>
            <BarChart data={revenueByDay.map((d) => d.value)} labels={revenueByDay.map((d) => d.label)} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-subhead">Planos</h2>
            <div className="mt-4 grid gap-3">
              {planCounts.map((plan) => (
                <div key={plan.id} className="grid gap-1">
                  <div className="flex justify-between text-sm"><span>{plan.name}</span><span className="font-medium">{plan.count}</span></div>
                  <div className="h-2 rounded-full bg-canvas"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${orgs.length ? (plan.count / orgs.length) * 100 : 0}%` }} /></div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardBody>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-subhead">Organizações por volume</h2>
              <Link href="/admin/orgs" className="link text-sm">Ver todas</Link>
            </div>
            <div className="grid gap-3">
              {orgRevenue.map((org) => (
                <div key={org.id} className="rounded-xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{org.displayName}</div>
                      <div className="text-xs text-muted">{org.slug} · {org._count.donations} doações · {org._count.donors} doadores</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold tabular-nums">{formatBRL(org.revenue30)}</div>
                      <StatusBadge status={org.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-subhead">Fila e eventos</h2>
            <div className="mt-4 space-y-4">
              <div>
                <p className="eyebrow">KYC</p>
                <div className="mt-2 grid gap-2">
                  {pendingKyc.length ? pendingKyc.map((o) => (
                    <Link key={o.id} href="/admin" className="flex items-center justify-between rounded-lg border border-line bg-canvas px-3 py-2 text-sm no-underline hover:bg-surface">
                      <span className="truncate">{o.displayName}</span><StatusBadge status={o.kycStatus} />
                    </Link>
                  )) : <p className="text-sm text-muted">Sem KYC pendente.</p>}
                </div>
              </div>
              <div>
                <p className="eyebrow">Webhooks recentes</p>
                <div className="mt-2 grid gap-2">
                  {gatewayEvents.map((ev) => (
                    <div key={ev.id} className="rounded-lg border border-line bg-canvas px-3 py-2 text-xs">
                      <div className="flex justify-between gap-2"><span className="font-medium">{ev.type}</span><Badge tone={ev.error ? "danger" : ev.processedAt ? "success" : "warn"}>{ev.error ? "Erro" : ev.processedAt ? "Processado" : "Pendente"}</Badge></div>
                      {ev.error && <p className="mt-1 truncate text-danger">{ev.error}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </section>

      <Card className="mt-5">
        <CardBody>
          <h2 className="text-subhead">Últimas doações pagas</h2>
          <div className="mt-4 grid gap-2">
            {recentDonations.map((d) => (
              <div key={d.id} className="grid gap-2 rounded-lg border border-line bg-surface p-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
                <div><span className="font-medium">{d.donor.name}</span><span className="text-muted"> · {d.donor.email} · {d.organization.displayName}</span></div>
                <div className="font-semibold tabular-nums">{formatBRL(d.amountCents + d.tipCents)}</div>
                <div className="text-xs text-muted">{d.paidAt?.toLocaleString("pt-BR")}</div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="card p-5"><p className="eyebrow">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p><p className="mt-1 text-xs text-muted">{detail}</p></div>;
}

function BarChart({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="h-64 rounded-xl border border-line bg-canvas p-4">
      <div className="flex h-full items-end gap-1">
        {data.map((v, i) => (
          <div key={`${labels[i]}-${i}`} className="group flex min-w-0 flex-1 flex-col items-center gap-2">
            <div title={`${labels[i]} · ${formatBRL(v)}`} className="w-full rounded-t bg-brand-600/80 transition-colors group-hover:bg-brand-600" style={{ height: `${Math.max(4, (v / max) * 100)}%` }} />
            {i % 5 === 0 && <span className="text-3xs text-faint">{labels[i]}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
