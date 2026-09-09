import Link from "next/link";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { getEmailTemplateList } from "@/server/crm/email-templates-queries";
import { EmailLogoCard } from "@/components/crm/EmailLogoCard";
import { TemplateToggle } from "@/components/crm/TemplateToggle";
import { PageHeader, Card, Alert, Badge } from "@/components/ui";

const CATEGORY_LABEL: Record<string, string> = {
  donation: "Doação",
  payment: "Instruções de pagamento",
  recovery: "Recuperação",
  relationship: "Relacionamento",
};

export default async function EmailTemplatesPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "ADMIN");

  const [items, cfg] = await Promise.all([
    getEmailTemplateList(db, orgId),
    db.organizationEmailConfig.findUnique({
      where: { organizationId: orgId },
      select: { logoUrl: true, domainStatus: true, fromName: true },
    }),
  ]);

  const grouped = Object.entries(CATEGORY_LABEL).map(([cat, label]) => ({
    cat,
    label,
    rows: items.filter((i) => i.meta.category === cat),
  }));

  const senderUnverified = cfg?.domainStatus !== "VERIFIED";

  return (
    <>
      <PageHeader
        title="Templates de e-mail"
        description="Os e-mails que a plataforma envia em nome da sua organização. Edite o texto de cada um."
        back={{ href: `/orgs/${orgId}/broadcasts`, label: "Comunicação" }}
      />

      <div className="space-y-4">
        <EmailLogoCard orgId={orgId} logoUrl={cfg?.logoUrl ?? null} />

        {senderUnverified && (
          <Alert tone="warn">
            Seus e-mails saem pelo domínio da plataforma com o nome da organização.{" "}
            <Link href={`/orgs/${orgId}/domains`} className="font-semibold underline">
              Verificar um domínio próprio
            </Link>
          </Alert>
        )}

        {grouped.map(
          (g) =>
            g.rows.length > 0 && (
              <section key={g.cat}>
                <h2 className="eyebrow mb-2">{g.label}</h2>
                <Card className="divide-y divide-line overflow-hidden">
                  {g.rows.map((r) => (
                    <div key={r.meta.kind} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/orgs/${orgId}/broadcasts/templates/${r.meta.kind}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {r.meta.label}
                          </Link>
                          {r.customized ? (
                            <Badge tone="success">Personalizado</Badge>
                          ) : (
                            <Badge tone="neutral">Padrão</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted">{r.meta.description}</p>
                      </div>
                      {r.meta.optIn && <TemplateToggle orgId={orgId} kind={r.meta.kind} enabled={r.enabled} />}
                      <Link
                        href={`/orgs/${orgId}/broadcasts/templates/${r.meta.kind}`}
                        className="text-faint hover:text-ink"
                        aria-label={`Editar ${r.meta.label}`}
                      >
                        ›
                      </Link>
                    </div>
                  ))}
                </Card>
              </section>
            ),
        )}
      </div>
    </>
  );
}
