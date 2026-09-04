import Link from "next/link";
import { formatBRL } from "@donation/shared";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { getCampaignsSummary } from "@/server/panel/summaries";
import { RowMenu } from "@/components/RowMenu";
import {
  PageHeader,
  LinkButton,
  EmptyState,
  StatusBadge,
  Alert,
  Card,
  Table,
  Th,
  Td,
  Tr,
  SummaryStrip,
} from "@/components/ui";

export default async function CampaignsList({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "VIEWER");

  const [org, summary, campaigns] = await Promise.all([
    db.organization.findFirst({ where: { id: orgId }, select: { status: true } }),
    getCampaignsSummary(orgId),
    db.campaign.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        raisedCents: true,
        goalCents: true,
        donorsCount: true,
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Campanhas"
        actions={<LinkButton href={`/orgs/${orgId}/campaigns/new`}>Nova campanha</LinkButton>}
      />

      {org?.status !== "ACTIVE" && (
        <div className="mb-4">
          <Alert>
            A organização ainda não foi aprovada — campanhas não podem ser publicadas nem receber doações.{" "}
            <Link href={`/orgs/${orgId}/settings`} className="font-semibold underline">
              Ver status do cadastro
            </Link>
          </Alert>
        </div>
      )}

      {campaigns.length === 0 ? (
        <EmptyState>Nenhuma campanha ainda. Crie a primeira.</EmptyState>
      ) : (
        <div className="space-y-4">
          <SummaryStrip
            stats={[
              { label: "Campanhas", value: summary.total },
              { label: "Publicadas", value: summary.published },
              { label: "Arrecadado", value: formatBRL(summary.raisedCents) },
              { label: "Doadores", value: summary.donorsCount },
            ]}
            segments={[
              { label: "Publicada", value: summary.byStatus.PUBLISHED, color: "bg-brand-500" },
              { label: "Rascunho", value: summary.byStatus.DRAFT, color: "bg-line-strong" },
              { label: "Pausada", value: summary.byStatus.PAUSED, color: "bg-accent-400" },
              { label: "Encerrada", value: summary.byStatus.CLOSED, color: "bg-faint" },
            ]}
          />

          <Card className="overflow-hidden">
            <Table>
              <thead>
                <Tr>
                  <Th>Campanha</Th>
                  <Th>Arrecadado</Th>
                  <Th>Doadores</Th>
                  <Th>Status</Th>
                  <Th className="w-10" />
                </Tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <Tr key={c.id}>
                    <Td>
                      <Link href={`/orgs/${orgId}/campaigns/${c.id}`} className="link">
                        {c.title}
                      </Link>
                      <div className="text-xs text-muted">/{c.slug}</div>
                    </Td>
                    <Td className="tabular-nums">
                      {formatBRL(c.raisedCents)}
                      {c.goalCents ? <span className="text-muted"> / {formatBRL(c.goalCents)}</span> : null}
                    </Td>
                    <Td className="tabular-nums">{c.donorsCount}</Td>
                    <Td>
                      <StatusBadge status={c.status} />
                    </Td>
                    <Td className="text-right">
                      <RowMenu
                        actions={[
                          { label: "Editar página", href: `/orgs/${orgId}/campaigns/${c.id}/editor` },
                          { label: "Configurações", href: `/orgs/${orgId}/campaigns/${c.id}` },
                          { label: "Pré-visualizar", href: `/orgs/${orgId}/campaigns/${c.id}/preview` },
                        ]}
                      />
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
