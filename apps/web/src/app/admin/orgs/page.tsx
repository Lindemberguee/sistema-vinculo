import Link from "next/link";
import { prisma } from "@donation/db";
import { formatBRL } from "@donation/shared";
import { requirePlatformAdminPage } from "@/server/admin-helpers";
import { AdminOrgActions } from "@/components/admin/AdminOrgRow";
import { appPanelOrigin, orgPublicOrigin } from "@/server/links/url";
import { PageHeader, Card, CardBody, Table, Th, Td, Tr, StatusBadge, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const SUB_TONE: Record<string, "success" | "warn" | "danger" | "neutral"> = {
  ACTIVE: "success",
  TRIALING: "neutral",
  PAST_DUE: "danger",
  CANCELED: "neutral",
};

export default async function AdminOrgs() {
  await requirePlatformAdminPage();
  const appOrigin = appPanelOrigin();

  const [orgs, plans, donationTotals] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        displayName: true,
        legalName: true,
        slug: true,
        status: true,
        kycStatus: true,
        planId: true,
        createdAt: true,
        plan: { select: { name: true, monthlyCents: true } },
        subscription: { select: { status: true, currentPeriodEnd: true, lastPaidAt: true } },
        paymentConfig: { select: { provider: true, verifiedAt: true, updatedAt: true } },
        _count: { select: { campaigns: true, donors: true, donations: true, memberships: true } },
      },
    }),
    prisma.plan.findMany({ orderBy: { monthlyCents: "asc" }, select: { id: true, name: true } }),
    prisma.donation.groupBy({
      by: ["organizationId"],
      where: { status: "PAID" },
      _sum: { amountCents: true, tipCents: true, gatewayFeeCents: true, platformFeeCents: true },
      _count: { _all: true },
    }),
  ]);

  const totals = new Map(donationTotals.map((t) => [t.organizationId, t]));
  const active = orgs.filter((o) => o.status === "ACTIVE").length;
  const kycPending = orgs.filter((o) => ["SUBMITTED", "IN_REVIEW"].includes(o.kycStatus)).length;
  const integrated = orgs.filter((o) => Boolean(o.paymentConfig?.verifiedAt)).length;
  const gross = donationTotals.reduce((s, t) => s + (t._sum.amountCents ?? 0) + (t._sum.tipCents ?? 0), 0);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <PageHeader
        title="Organizações"
        description="Operação, planos, KYC, gateways e volume financeiro por cliente."
        actions={<Link href="/admin" className="btn-secondary btn-sm no-underline">← Visão geral</Link>}
      />

      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <Kpi label="Organizações" value={orgs.length.toString()} detail={`${active} ativas`} />
        <Kpi label="KYC pendente" value={kycPending.toString()} detail="enviadas ou em análise" />
        <Kpi label="Gateways OK" value={`${integrated}/${orgs.length}`} detail="contas conectadas" />
        <Kpi label="Volume total" value={formatBRL(gross)} detail="doações pagas" />
      </section>

      <Card className="overflow-hidden">
        <CardBody className="p-0">
          <Table dense>
            <thead>
              <Tr>
                <Th>Organização</Th>
                <Th>Status</Th>
                <Th>Gateway</Th>
                <Th>Uso</Th>
                <Th>Volume / taxas</Th>
                <Th>Assinatura</Th>
                <Th className="min-w-72">Ações</Th>
              </Tr>
            </thead>
            <tbody>
              {orgs.map((o) => {
                const t = totals.get(o.id);
                const total = (t?._sum.amountCents ?? 0) + (t?._sum.tipCents ?? 0);
                const fees = (t?._sum.gatewayFeeCents ?? 0) + (t?._sum.platformFeeCents ?? 0);
                return (
                  <Tr key={o.id}>
                    <Td>
                      <div className="font-medium">{o.displayName}</div>
                      <div className="text-xs text-muted">{o.slug} · {o.legalName}</div>
                      <div className="mt-1 text-2xs text-faint">Criada em {dt.format(o.createdAt)}</div>
                    </Td>
                    <Td>
                      <div className="grid gap-1"><StatusBadge status={o.status} /><StatusBadge status={o.kycStatus} /></div>
                    </Td>
                    <Td>
                      {o.paymentConfig ? (
                        <div className="grid gap-1 text-xs"><Badge tone={o.paymentConfig.verifiedAt ? "success" : "warn"}>{o.paymentConfig.provider}</Badge><span className="text-muted">{o.paymentConfig.verifiedAt ? `verificado ${dt.format(o.paymentConfig.verifiedAt)}` : "sem verificação"}</span></div>
                      ) : <Badge>Sem gateway</Badge>}
                    </Td>
                    <Td className="text-sm">
                      <div>{o._count.campaigns} campanhas</div>
                      <div className="text-muted">{o._count.donors} doadores · {o._count.memberships} usuários</div>
                    </Td>
                    <Td>
                      <div className="font-semibold tabular-nums">{formatBRL(total)}</div>
                      <div className="text-xs text-muted">{t?._count._all ?? 0} doações · taxas {formatBRL(fees)}</div>
                    </Td>
                    <Td>
                      <div className="font-medium">{o.plan.name}</div>
                      <div className="text-xs text-muted">{formatBRL(o.plan.monthlyCents)}/mês</div>
                      {o.subscription ? <Badge tone={SUB_TONE[o.subscription.status] ?? "neutral"}>{o.subscription.status}</Badge> : <div className="text-xs text-faint">sem assinatura</div>}
                    </Td>
                    <Td>
                      <AdminOrgActions orgId={o.id} planId={o.planId} orgStatus={o.status} plans={plans} />
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <Link href={`${appOrigin}/orgs/${o.id}`} className="link">Abrir painel</Link>
                        <Link href={orgPublicOrigin({ slug: o.slug })} target="_blank" className="link">Site público</Link>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </main>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="card p-5"><p className="eyebrow">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted">{detail}</p></div>;
}
