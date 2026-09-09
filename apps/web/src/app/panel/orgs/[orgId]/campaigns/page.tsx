import Link from "next/link";
import { formatBRL } from "@donation/shared";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { getCampaignsSummary } from "@/server/panel/summaries";
import { orgPublicOrigin } from "@/server/links/url";
import { RowMenu } from "@/components/RowMenu";
import { CopyButton } from "@/components/public/CopyButton";
import { NewCampaignButton } from "@/components/NewCampaignButton";
import {
  PageHeader,
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
    db.organization.findFirst({
      where: { id: orgId },
      select: {
        status: true,
        slug: true,
        customDomains: { where: { verifiedAt: { not: null } }, take: 1, select: { host: true } },
      },
    }),
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
  const publicOrigin = org ? orgPublicOrigin({ slug: org.slug, customHost: org.customDomains[0]?.host ?? null }) : null;

  return (
    <>
      <PageHeader title="Campanhas" actions={<NewCampaignButton orgId={orgId} />} />

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
        <EmptyState
          title="Nenhuma campanha ainda"
          action={
            <NewCampaignButton orgId={orgId}>Criar a primeira campanha</NewCampaignButton>
          }
        >
          Crie uma campanha e configure a página no editor de blocos.
        </EmptyState>
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
                      {publicOrigin && c.status === "PUBLISHED" && (
                        <div className="mt-1 flex min-w-0 items-center gap-1.5">
                          <a
                            href={`${publicOrigin}/${c.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 truncate text-xs text-brand-700 hover:underline"
                          >
                            Abrir página pública ↗
                          </a>
                          <CopyButton text={`${publicOrigin}/${c.slug}`} label="Copiar link" />
                        </div>
                      )}
                      {publicOrigin && c.status !== "PUBLISHED" && (
                        <div className="mt-1 text-xs text-faint">Link público disponível após publicar</div>
                      )}
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
