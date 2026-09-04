import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { KycCard } from "@/components/OrgSettingsClient";
import { EmailSenderCard } from "@/components/crm/EmailSenderCard";
import { PageHeader, Card, CardBody } from "@/components/ui";

export default async function OrgSettings({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "ADMIN");

  const org = await db.organization.findFirst({
    where: { id: orgId },
    select: {
      displayName: true,
      status: true,
      kycStatus: true,
      planId: true,
      gatewayRecipientId: true,
      _count: { select: { kycDocuments: true } },
      emailConfig: { select: { fromName: true, replyTo: true, domainStatus: true } },
      kyc: { select: { contactEmail: true } },
    },
  });
  if (!org) notFound();

  return (
    <>
      <PageHeader title="Configurações da organização" />

      <div className="grid gap-4">
        <KycCard
          orgId={orgId}
          orgStatus={org.status}
          kycStatus={org.kycStatus}
          docCount={org._count.kycDocuments}
          hasRecipient={Boolean(org.gatewayRecipientId)}
        />

        <EmailSenderCard
          orgId={orgId}
          fromName={org.emailConfig?.fromName ?? null}
          replyTo={org.emailConfig?.replyTo ?? null}
          fallbackName={org.displayName}
          fallbackReplyTo={org.kyc?.contactEmail ?? null}
          domainStatus={org.emailConfig?.domainStatus ?? "NONE"}
        />

        <Card>
          <CardBody>
            <h2 className="mb-2 text-base font-semibold">Integrações</h2>
            <ul className="grid gap-1.5 text-sm">
              <li>
                <Link href={`/orgs/${orgId}/billing`} className="link">
                  Plano e cobrança
                </Link>
              </li>
              <li>
                <Link href={`/orgs/${orgId}/domains`} className="link">
                  Domínios (páginas e e-mail)
                </Link>
              </li>
              <li>
                <Link href={`/orgs/${orgId}/webhooks`} className="link">
                  Webhooks de saída
                </Link>
              </li>
              <li>
                <Link href={`/orgs/${orgId}/settings/notifications`} className="link">
                  Notificações da equipe
                </Link>
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
