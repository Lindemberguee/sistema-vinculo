import { requireOrgAccessPage } from "@/server/auth-helpers";
import { WebhooksPanel } from "@/components/WebhooksPanel";
import { PageHeader } from "@/components/ui";

export default async function WebhooksPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "ADMIN");

  const hooks = await db.outboundWebhook.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      url: true,
      events: true,
      active: true,
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, event: true, createdAt: true, responseCode: true },
      },
    },
  });

  return (
    <>
      <PageHeader
        title="Webhooks de saída"
        description="Receba eventos de doação no seu sistema (CRM, planilha, Zapier). Cada entrega é assinada com HMAC-SHA256."
        back={{ href: `/orgs/${orgId}/settings`, label: "Configurações" }}
      />
      <WebhooksPanel
        orgId={orgId}
        hooks={hooks.map((h) => ({
          ...h,
          lastDelivery: h.deliveries[0]
            ? { ...h.deliveries[0], createdAt: h.deliveries[0].createdAt.toISOString() }
            : null,
        }))}
      />
    </>
  );
}
