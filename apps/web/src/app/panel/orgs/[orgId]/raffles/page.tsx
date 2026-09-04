import Link from "next/link";
import { formatBRL } from "@donation/shared";
import { getOrgLimits, planHasModule } from "@donation/db";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { getRafflesSummary } from "@/server/panel/summaries";
import { ModuleLockedNotice } from "@/components/ModuleLockedNotice";
import {
  PageHeader,
  LinkButton,
  EmptyState,
  Card,
  Table,
  Th,
  Td,
  Tr,
  StatusBadge,
  SummaryStrip,
} from "@/components/ui";

export default async function RafflesList({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "VIEWER");
  const locked = !planHasModule(await getOrgLimits(orgId), "raffles");

  const [summary, raffles] = await Promise.all([
    getRafflesSummary(orgId),
    db.raffle.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        ticketPriceCents: true,
        totalNumbers: true,
        _count: { select: { tickets: { where: { status: "PAID" } } } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Rifas"
        actions={locked ? undefined : <LinkButton href={`/orgs/${orgId}/raffles/new`}>Nova rifa</LinkButton>}
      />
      {locked && (
        <div className="mb-4">
          <ModuleLockedNotice module="raffles" orgId={orgId} />
        </div>
      )}
      {raffles.length === 0 ? (
        locked ? null : <EmptyState>Nenhuma rifa ainda.</EmptyState>
      ) : (
        <div className="space-y-4">
          <SummaryStrip
            stats={[
              { label: "Rifas", value: summary.total },
              { label: "Abertas", value: summary.open },
              { label: "Números vendidos", value: summary.soldNumbers },
              { label: "Arrecadado", value: formatBRL(summary.revenueCents) },
            ]}
            segments={[
              { label: "Aberta", value: summary.byStatus.OPEN, color: "bg-brand-500" },
              { label: "Rascunho", value: summary.byStatus.DRAFT, color: "bg-line-strong" },
              { label: "Encerrada", value: summary.byStatus.CLOSED, color: "bg-accent-400" },
              { label: "Sorteada", value: summary.byStatus.DRAWN, color: "bg-faint" },
              { label: "Cancelada", value: summary.byStatus.CANCELED, color: "bg-danger" },
            ]}
          />

          <Card className="overflow-hidden">
            <Table>
              <thead>
                <Tr>
                  <Th>Título</Th>
                  <Th>Preço</Th>
                  <Th>Vendidos</Th>
                  <Th>Status</Th>
                </Tr>
              </thead>
              <tbody>
                {raffles.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <Link href={`/orgs/${orgId}/raffles/${r.id}`} className="link">
                        {r.title}
                      </Link>
                    </Td>
                    <Td className="tabular-nums">{formatBRL(r.ticketPriceCents)}</Td>
                    <Td className="tabular-nums">
                      {r._count.tickets} / {r.totalNumbers}
                    </Td>
                    <Td>
                      <StatusBadge status={r.status} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      )}
    </>
  );
}
