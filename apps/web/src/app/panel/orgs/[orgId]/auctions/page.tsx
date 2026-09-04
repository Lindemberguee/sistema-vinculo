import Link from "next/link";
import { getOrgLimits, planHasModule } from "@donation/db";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { getAuctionsSummary } from "@/server/panel/summaries";
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

export default async function AuctionsList({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "VIEWER");
  const locked = !planHasModule(await getOrgLimits(orgId), "auctions");

  const [summary, auctions] = await Promise.all([
    getAuctionsSummary(orgId),
    db.auction.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true, _count: { select: { lots: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Leilões"
        actions={locked ? undefined : <LinkButton href={`/orgs/${orgId}/auctions/new`}>Novo leilão</LinkButton>}
      />
      {locked && (
        <div className="mb-4">
          <ModuleLockedNotice module="auctions" orgId={orgId} />
        </div>
      )}
      {auctions.length === 0 ? (
        locked ? null : <EmptyState>Nenhum leilão ainda.</EmptyState>
      ) : (
        <div className="space-y-4">
          <SummaryStrip
            stats={[
              { label: "Leilões", value: summary.total },
              { label: "Abertos", value: summary.open },
              { label: "Lotes", value: summary.lots },
              { label: "Lotes vendidos", value: summary.soldLots },
            ]}
            segments={[
              { label: "Aberto", value: summary.byStatus.OPEN, color: "bg-brand-500" },
              { label: "Rascunho", value: summary.byStatus.DRAFT, color: "bg-line-strong" },
              { label: "Encerrado", value: summary.byStatus.ENDED, color: "bg-accent-400" },
              { label: "Concluído", value: summary.byStatus.SETTLED, color: "bg-faint" },
              { label: "Cancelado", value: summary.byStatus.CANCELED, color: "bg-danger" },
            ]}
          />

          <Card className="overflow-hidden">
            <Table>
              <thead>
                <Tr>
                  <Th>Título</Th>
                  <Th>Lotes</Th>
                  <Th>Status</Th>
                </Tr>
              </thead>
              <tbody>
                {auctions.map((a) => (
                  <Tr key={a.id}>
                    <Td>
                      <Link href={`/orgs/${orgId}/auctions/${a.id}`} className="link">
                        {a.title}
                      </Link>
                    </Td>
                    <Td className="tabular-nums">{a._count.lots}</Td>
                    <Td>
                      <StatusBadge status={a.status} />
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
