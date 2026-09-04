import { formatBRL } from "@donation/shared";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { getFinanceOverview } from "@/server/panel/finance";
import { PageHeader, Card, CardBody, Table, Th, Td, Tr, SummaryStrip } from "@/components/ui";

const METHOD_LABEL: Record<string, string> = {
  PIX: "Pix",
  CREDIT_CARD: "Cartão de crédito",
  BOLETO: "Boleto",
};

const fmtCurrency = (cents: number, currency: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);

export default async function FinancePage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  await requireOrgAccessPage(orgId, "FINANCE");

  const f = await getFinanceOverview(orgId);
  const topOrigin = f.byOrigin[0]?.netCents || 1;

  return (
    <>
      <PageHeader
        title="Finanças"
        description="Acompanhe o que foi pago e o que o gateway ainda vai liberar para sua organização."
      />

      <div className="space-y-4">
        <SummaryStrip
          stats={[
            { label: "Bruto arrecadado", value: formatBRL(f.grossCents) },
            { label: "Taxas do gateway", value: formatBRL(f.platformFeeCents) },
            { label: "Líquido recebido pela ONG", value: formatBRL(f.netCents) },
            { label: "Repassado", value: formatBRL(f.paidOutCents) },
            { label: "Estornado", value: formatBRL(f.reversedCents) },
          ]}
        />

        <Card className="border-l-2 border-l-brand-500">
          <CardBody>
            <div className="eyebrow">Saldo a repassar</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
              {formatBRL(f.balanceCents)}
            </div>
            <p className="mt-1 text-xs text-muted">
              de {formatBRL(f.netCents)} líquidos no total · repasses são feitos pelo gateway conforme o prazo de
              liberação.
            </p>
          </CardBody>
        </Card>

        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardBody>
              <h2 className="text-sm font-semibold">Por origem</h2>
              {f.byOrigin.length > 0 ? (
                <ul className="mt-3 space-y-2.5">
                  {f.byOrigin.map((o) => (
                    <li key={o.title} className="grid gap-1">
                      <div className="flex items-baseline justify-between gap-4 text-sm">
                        <span className="truncate">{o.title}</span>
                        <span className="shrink-0 tabular-nums text-muted">{formatBRL(o.netCents)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${Math.max(2, (o.netCents / topOrigin) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">Nenhum recebimento ainda.</p>
              )}
            </CardBody>
          </Card>

          <Card className="overflow-hidden lg:col-span-3">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="text-sm font-semibold">Recebimentos recentes</h2>
            </div>
            <Table>
              <thead>
                <Tr>
                  <Th>Data</Th>
                  <Th>Campanha</Th>
                  <Th>Método</Th>
                  <Th className="text-right">Líquido</Th>
                </Tr>
              </thead>
              <tbody>
                {f.recent.map((r) => (
                  <Tr key={r.id}>
                    <Td>{r.paidAt ? r.paidAt.toLocaleDateString("pt-BR") : "—"}</Td>
                    <Td className="max-w-[16rem] truncate">{r.campaignTitle ?? "—"}</Td>
                    <Td>{METHOD_LABEL[r.method] ?? r.method}</Td>
                    <Td className="text-right tabular-nums">{formatBRL(r.netToOrgCents)}</Td>
                  </Tr>
                ))}
                {f.recent.length === 0 && (
                  <Tr>
                    <Td colSpan={4} className="text-muted">
                      Nenhum recebimento ainda.
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          </Card>
        </div>

        {f.intl.length > 0 && (
          <Card>
            <CardBody>
              <h2 className="text-sm font-semibold">Doações internacionais</h2>
              <p className="mt-0.5 text-xs text-muted">
                Recebidas via gateway internacional. O repasse para a organização é feito manualmente.
              </p>
              <ul className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                {f.intl.map((i) => (
                  <li key={i.currency}>
                    <span className="eyebrow block">{i.currency}</span>
                    <span className="font-semibold tabular-nums">{fmtCurrency(i.grossCents, i.currency)}</span>
                    <span className="ml-1.5 text-xs text-muted">({i.count})</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
