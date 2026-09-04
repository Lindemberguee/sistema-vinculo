import Link from "next/link";
import { formatBRL } from "@donation/shared";
import { getOrgLimits, planHasModule } from "@donation/db";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { getSponseesSummary } from "@/server/panel/summaries";
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

export default async function SponseesList({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "VIEWER");
  const locked = !planHasModule(await getOrgLimits(orgId), "sponsees");

  const [summary, sponsees] = await Promise.all([
    getSponseesSummary(orgId),
    db.sponsee.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, category: true, status: true, monthlyAmountCents: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Apadrinhamento"
        description="Cadastre afilhados; doadores escolhem um e criam uma doação mensal vinculada."
        actions={locked ? undefined : <LinkButton href={`/orgs/${orgId}/sponsees/new`}>Novo afilhado</LinkButton>}
      />

      {locked && (
        <div className="mb-4">
          <ModuleLockedNotice module="sponsees" orgId={orgId} />
        </div>
      )}
      {sponsees.length === 0 ? (
        locked ? null : <EmptyState>Nenhum afilhado cadastrado.</EmptyState>
      ) : (
        <div className="space-y-4">
          <SummaryStrip
            stats={[
              { label: "Afilhados", value: summary.total },
              { label: "Apadrinhados", value: summary.sponsored },
              { label: "Disponíveis", value: summary.available },
              { label: "Compromisso mensal", value: formatBRL(summary.monthlyCommittedCents) },
            ]}
            segments={[
              { label: "Apadrinhado", value: summary.byStatus.SPONSORED, color: "bg-brand-500" },
              { label: "Disponível", value: summary.byStatus.AVAILABLE, color: "bg-accent-400" },
              { label: "Arquivado", value: summary.byStatus.RETIRED, color: "bg-faint" },
            ]}
          />

          <Card className="overflow-hidden">
            <Table>
              <thead>
                <Tr>
                  <Th>Nome</Th>
                  <Th>Categoria</Th>
                  <Th>Valor mensal</Th>
                  <Th>Status</Th>
                </Tr>
              </thead>
              <tbody>
                {sponsees.map((s) => (
                  <Tr key={s.id}>
                    <Td>
                      <Link href={`/orgs/${orgId}/sponsees/${s.id}`} className="link">
                        {s.name}
                      </Link>
                    </Td>
                    <Td>{s.category}</Td>
                    <Td className="tabular-nums">{formatBRL(s.monthlyAmountCents)}</Td>
                    <Td>
                      <StatusBadge status={s.status} />
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
