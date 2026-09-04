import Link from "next/link";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { getBroadcasts } from "@/server/crm/broadcasts-queries";
import { PageHeader, LinkButton, EmptyState, Card, Table, Th, Td, Tr, Badge } from "@/components/ui";

const STATUS: Record<string, { label: string; tone: "neutral" | "success" | "warn" | "danger" }> = {
  DRAFT: { label: "Rascunho", tone: "neutral" },
  SCHEDULED: { label: "Agendada", tone: "warn" },
  SENDING: { label: "Enviando", tone: "warn" },
  SENT: { label: "Enviada", tone: "success" },
  FAILED: { label: "Falhou", tone: "danger" },
};

const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default async function BroadcastsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "ADMIN");
  const rows = await getBroadcasts(db, orgId);

  return (
    <>
      <PageHeader
        title="Comunicação"
        description="E-mails únicos para segmentos de doadores. Réguas automáticas continuam separadas."
        back={{ href: `/orgs/${orgId}`, label: "Painel" }}
        actions={
          <>
            <LinkButton href={`/orgs/${orgId}/broadcasts/automations`} variant="secondary" size="sm">
              Automações
            </LinkButton>
            <LinkButton href={`/orgs/${orgId}/broadcasts/templates`} variant="secondary" size="sm">
              Templates de e-mail
            </LinkButton>
            <LinkButton href={`/orgs/${orgId}/broadcasts/new`}>Nova mensagem</LinkButton>
          </>
        }
      />

      {rows.length === 0 ? (
        <EmptyState>
          Nenhuma mensagem ainda. Comece pela lista de Doadores com um filtro, ou crie uma nova.
        </EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <thead>
              <Tr>
                <Th>Mensagem</Th>
                <Th>Status</Th>
                <Th>Envios</Th>
                <Th>Data</Th>
              </Tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const s = STATUS[b.status] ?? { label: b.status, tone: "neutral" as const };
                return (
                  <Tr key={b.id} className="relative hover:bg-canvas/70">
                    <Td>
                      <Link
                        href={`/orgs/${orgId}/broadcasts/${b.id}`}
                        className="absolute inset-0"
                        aria-label={`Abrir ${b.name || b.subject}`}
                      />
                      <div className="font-medium">{b.subject}</div>
                      {b.name && <div className="text-xs text-muted">{b.name}</div>}
                      {b.status === "FAILED" && b.error && (
                        <div className="mt-0.5 text-xs text-danger">{b.error}</div>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </Td>
                    <Td className="tabular-nums text-sm">
                      {b.status === "DRAFT" || b.status === "SCHEDULED" ? (
                        <span className="text-muted">até {b.recipientCount}</span>
                      ) : (
                        <>
                          {b.sentCount} / {b.recipientCount}
                          {b.skippedCount > 0 && <span className="text-muted"> · {b.skippedCount} pulados</span>}
                        </>
                      )}
                    </Td>
                    <Td className="text-sm">
                      {b.status === "SCHEDULED" && b.scheduledAt ? (
                        <span className="font-medium text-ink">{dt.format(b.scheduledAt)}</span>
                      ) : (
                        (b.sentAt ?? b.createdAt).toLocaleDateString("pt-BR")
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
