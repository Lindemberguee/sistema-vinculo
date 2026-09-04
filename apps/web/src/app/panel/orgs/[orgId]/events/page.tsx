import Link from "next/link";
import { formatBRL } from "@donation/shared";
import { getOrgLimits, planHasModule } from "@donation/db";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { getEventsSummary } from "@/server/panel/summaries";
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

export default async function EventsList({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "VIEWER");
  const locked = !planHasModule(await getOrgLimits(orgId), "events");

  const [summary, events] = await Promise.all([
    getEventsSummary(orgId),
    db.event.findMany({
      orderBy: { startsAt: "desc" },
      select: {
        id: true,
        title: true,
        venue: true,
        startsAt: true,
        status: true,
        _count: { select: { tickets: { where: { status: { in: ["VALID", "USED"] } } } } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Eventos"
        actions={locked ? undefined : <LinkButton href={`/orgs/${orgId}/events/new`}>Novo evento</LinkButton>}
      />
      {locked && (
        <div className="mb-4">
          <ModuleLockedNotice module="events" orgId={orgId} />
        </div>
      )}
      {events.length === 0 ? (
        locked ? null : <EmptyState>Nenhum evento ainda.</EmptyState>
      ) : (
        <div className="space-y-4">
          <SummaryStrip
            stats={[
              { label: "Eventos", value: summary.total },
              { label: "Publicados", value: summary.published },
              { label: "Ingressos vendidos", value: summary.ticketsSold },
              { label: "Receita", value: formatBRL(summary.revenueCents) },
            ]}
            segments={[
              { label: "Publicado", value: summary.byStatus.PUBLISHED, color: "bg-brand-500" },
              { label: "Rascunho", value: summary.byStatus.DRAFT, color: "bg-line-strong" },
              { label: "Encerrado", value: summary.byStatus.ENDED, color: "bg-accent-400" },
              { label: "Cancelado", value: summary.byStatus.CANCELED, color: "bg-danger" },
            ]}
          />

          <Card className="overflow-hidden">
            <Table>
              <thead>
                <Tr>
                  <Th>Título</Th>
                  <Th>Quando</Th>
                  <Th>Ingressos vendidos</Th>
                  <Th>Status</Th>
                </Tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <Tr key={e.id}>
                    <Td>
                      <Link href={`/orgs/${orgId}/events/${e.id}`} className="link">
                        {e.title}
                      </Link>
                      <div className="text-xs text-muted">{e.venue}</div>
                    </Td>
                    <Td>{e.startsAt.toLocaleString("pt-BR")}</Td>
                    <Td className="tabular-nums">{e._count.tickets}</Td>
                    <Td>
                      <StatusBadge status={e.status} />
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
