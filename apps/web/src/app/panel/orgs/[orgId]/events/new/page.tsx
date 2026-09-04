import { requireOrgAccessPage } from "@/server/auth-helpers";
import { EventForm } from "@/components/EventForm";
import { PageHeader } from "@/components/ui";

export default async function NewEvent({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "EDITOR");
  const campaigns = await db.campaign.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } });
  return (
    <>
      <PageHeader title="Novo evento" back={{ href: `/orgs/${orgId}/events`, label: "Eventos" }} />
      <EventForm orgId={orgId} campaigns={campaigns} />
    </>
  );
}
