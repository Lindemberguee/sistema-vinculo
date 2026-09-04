import { EMAIL_TEMPLATES, SEGMENT_TRIGGER_KINDS } from "@donation/emails";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import {
  AnnualStatementCard,
  AutomationRowActions,
  AutomationStatusBadge,
  SegmentAutomationForm,
} from "@/components/crm/SegmentAutomationsClient";
import { PageHeader, Card, CardBody, Table, Th, Td, Tr, EmptyState } from "@/components/ui";

export default async function AutomationsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "ADMIN");

  const [segments, rules] = await Promise.all([
    db.donorSegment.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.segmentAutomation.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        templateKind: true,
        delayDays: true,
        enabled: true,
        sentCount: true,
        segment: { select: { name: true } },
      },
    }),
  ]);

  const templateOpts = SEGMENT_TRIGGER_KINDS.map((k) => ({ value: k, label: EMAIL_TEMPLATES[k].label }));
  const segmentOpts = segments.map((s) => ({ value: s.id, label: s.name }));
  const thisYear = new Date().getFullYear();
  const years = [thisYear - 1, thisYear - 2, thisYear];

  return (
    <>
      <PageHeader
        title="Automações"
        description="Réguas de e-mail disparadas pelos dados dos doadores."
        back={{ href: `/orgs/${orgId}/broadcasts`, label: "Comunicação" }}
      />

      <div className="grid gap-4">
        <AnnualStatementCard orgId={orgId} years={years} />

        <Card>
          <CardBody className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Gatilhos por segmento</h2>
              <p className="mt-1 text-xs text-muted">
                Quando um doador <strong>entra</strong> num segmento, ele recebe o template escolhido depois do
                prazo. Quem já está no segmento agora não dispara — só quem entrar a partir de agora. Edite o
                conteúdo do template em <span className="whitespace-nowrap">Comunicação → Templates de e-mail</span>.
              </p>
            </div>

            <SegmentAutomationForm orgId={orgId} segments={segmentOpts} templates={templateOpts} />

            {rules.length === 0 ? (
              <EmptyState>Nenhum gatilho ainda.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <Tr>
                    <Th>Segmento</Th>
                    <Th>Template</Th>
                    <Th>Prazo</Th>
                    <Th>Enviados</Th>
                    <Th>Status</Th>
                    <Th className="w-32" />
                  </Tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <Tr key={r.id}>
                      <Td className="font-medium">{r.segment.name}</Td>
                      <Td>{EMAIL_TEMPLATES[r.templateKind]?.label ?? r.templateKind}</Td>
                      <Td className="tabular-nums text-sm">
                        {r.delayDays === 0 ? "no mesmo dia" : `após ${r.delayDays} ${r.delayDays === 1 ? "dia" : "dias"}`}
                      </Td>
                      <Td className="tabular-nums text-sm">{r.sentCount}</Td>
                      <Td>
                        <AutomationStatusBadge enabled={r.enabled} />
                      </Td>
                      <Td>
                        <AutomationRowActions
                          orgId={orgId}
                          row={{
                            id: r.id,
                            segmentName: r.segment.name,
                            templateLabel: EMAIL_TEMPLATES[r.templateKind]?.label ?? r.templateKind,
                            delayDays: r.delayDays,
                            enabled: r.enabled,
                            sentCount: r.sentCount,
                          }}
                        />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
