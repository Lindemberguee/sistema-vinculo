import { requireOrgAccessPage } from "@/server/auth-helpers";
import { ExportPanel } from "@/components/ExportPanel";
import { PageHeader, Card, Table, Th, Td, Tr, Badge } from "@/components/ui";

const STATUS: Record<string, { label: string; tone: "neutral" | "success" | "warn" | "danger" }> = {
  PENDING: { label: "Na fila", tone: "warn" },
  PROCESSING: { label: "Processando", tone: "warn" },
  DONE: { label: "Pronto", tone: "success" },
  FAILED: { label: "Falhou", tone: "danger" },
};

export default async function ExportsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "FINANCE");

  const exports = await db.export.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, kind: true, status: true, rowCount: true, createdAt: true, error: true, storageKey: true },
  });

  return (
    <>
      <PageHeader
        title="Exportações"
        description="Os arquivos são gerados em segundo plano e ficam disponíveis por download temporário."
      />

      <div className="mb-5">
        <ExportPanel orgId={orgId} />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <thead>
            <Tr>
              <Th>Quando</Th>
              <Th>Tipo</Th>
              <Th>Status</Th>
              <Th>Linhas</Th>
              <Th />
            </Tr>
          </thead>
          <tbody>
            {exports.map((e) => {
              const s = STATUS[e.status] ?? { label: e.status, tone: "neutral" as const };
              return (
                <Tr key={e.id}>
                  <Td>{e.createdAt.toLocaleString("pt-BR")}</Td>
                  <Td>{e.kind === "donors" ? "Doadores" : "Doações"}</Td>
                  <Td>
                    <Badge tone={s.tone}>{s.label}</Badge>
                    {e.error && <div className="mt-0.5 text-xs text-danger">{e.error}</div>}
                  </Td>
                  <Td className="tabular-nums">{e.rowCount ?? "—"}</Td>
                  <Td>
                    {e.status === "DONE" && e.storageKey && (
                      <a href={`/api/panel/exports/${e.id}/download`} className="link">
                        baixar CSV
                      </a>
                    )}
                  </Td>
                </Tr>
              );
            })}
            {exports.length === 0 && (
              <Tr>
                <Td colSpan={5} className="text-muted">
                  Nenhuma exportação ainda.
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
