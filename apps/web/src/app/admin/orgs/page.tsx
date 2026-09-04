import Link from "next/link";
import { prisma } from "@donation/db";
import { formatBRL } from "@donation/shared";
import { requirePlatformAdminPage } from "@/server/admin-helpers";
import { AdminOrgActions } from "@/components/admin/AdminOrgRow";
import { PageHeader, Card, Table, Th, Td, Tr, StatusBadge, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const SUB_TONE: Record<string, "success" | "warn" | "danger" | "neutral"> = {
  ACTIVE: "success",
  TRIALING: "neutral",
  PAST_DUE: "danger",
  CANCELED: "neutral",
};

type OrgBillingSummary = {
  status: string;
  plan: { monthlyCents: number } | null;
  subscription: { status: string } | null;
};

export default async function AdminOrgs() {
  await requirePlatformAdminPage();

  const [orgs, plans] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        displayName: true,
        slug: true,
        status: true,
        planId: true,
        plan: { select: { name: true, monthlyCents: true } },
        subscription: { select: { status: true, currentPeriodEnd: true, lastPaidAt: true } },
      },
    }),
    prisma.plan.findMany({ orderBy: { monthlyCents: "asc" }, select: { id: true, name: true } }),
  ]);

  const billingOrgs = orgs as OrgBillingSummary[];
  const mrr = billingOrgs.reduce((sum: number, o: OrgBillingSummary) => {
    const paying =
      (o.plan?.monthlyCents ?? 0) > 0 &&
      o.status === "ACTIVE" &&
      (o.subscription?.status === "ACTIVE" || o.subscription?.status === "TRIALING");
    return sum + (paying ? o.plan!.monthlyCents : 0);
  }, 0);
  const payingCount = billingOrgs.filter(
    (o: OrgBillingSummary) => (o.plan?.monthlyCents ?? 0) > 0 && o.status === "ACTIVE" && o.subscription?.status === "ACTIVE",
  ).length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        title="Organizações e planos"
        actions={
          <Link href="/admin" className="link text-sm">
            ← Fila de KYC
          </Link>
        }
      />

      <div className="mb-5 card p-5">
        <dl className="flex flex-wrap gap-y-3 [&>*+*]:ml-8 [&>*+*]:border-l [&>*+*]:border-line [&>*+*]:pl-8">
          <div>
            <dt className="eyebrow">Organizações</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{orgs.length}</dd>
          </div>
          <div>
            <dt className="eyebrow">Em plano pago ativo</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{payingCount}</dd>
          </div>
          <div>
            <dt className="eyebrow">MRR</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatBRL(mrr)}</dd>
          </div>
        </dl>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <thead>
            <Tr>
              <Th>Organização</Th>
              <Th>Org</Th>
              <Th>Assinatura</Th>
              <Th>Vencimento</Th>
              <Th>Pago em</Th>
              <Th className="w-72">Plano / ações</Th>
            </Tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <Tr key={o.id}>
                <Td>
                  <div className="font-medium">{o.displayName}</div>
                  <div className="text-xs text-muted">{o.slug}</div>
                </Td>
                <Td>
                  <StatusBadge status={o.status} />
                </Td>
                <Td>
                  {o.subscription ? (
                    <Badge tone={SUB_TONE[o.subscription.status] ?? "neutral"}>{o.subscription.status}</Badge>
                  ) : (
                    <span className="text-xs text-faint">—</span>
                  )}
                </Td>
                <Td className="text-sm">
                  {o.subscription ? dt.format(o.subscription.currentPeriodEnd) : "—"}
                </Td>
                <Td className="text-sm">
                  {o.subscription?.lastPaidAt ? dt.format(o.subscription.lastPaidAt) : "—"}
                </Td>
                <Td>
                  <AdminOrgActions orgId={o.id} planId={o.planId} orgStatus={o.status} plans={plans} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </main>
  );
}
