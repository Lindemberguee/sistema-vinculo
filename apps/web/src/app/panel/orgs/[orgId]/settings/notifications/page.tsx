import { requireOrgAccessPage } from "@/server/auth-helpers";
import { TeamNotificationsForm } from "@/components/crm/TeamNotificationsForm";
import { PageHeader, Card, CardBody } from "@/components/ui";

export default async function NotificationsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "ADMIN");

  const cfg = await db.organizationNotificationConfig.findUnique({ where: { organizationId: orgId } });

  return (
    <>
      <PageHeader
        title="Notificações da equipe"
        description="Alertas internos para o time da organização — separados dos e-mails aos doadores."
        back={{ href: `/orgs/${orgId}/settings`, label: "Configurações" }}
      />
      <Card>
        <CardBody>
          <TeamNotificationsForm
            orgId={orgId}
            recipients={cfg?.recipients ?? []}
            kycChanges={cfg?.kycChanges ?? true}
            recurringFailed={cfg?.recurringFailed ?? true}
            dailyDigest={cfg?.dailyDigest ?? false}
            digestHour={cfg?.digestHour ?? 9}
          />
        </CardBody>
      </Card>
    </>
  );
}
