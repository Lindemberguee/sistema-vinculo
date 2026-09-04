import { requireOrgAccessPage } from "@/server/auth-helpers";
import { RaffleForm } from "@/components/RaffleForm";
import { PageHeader } from "@/components/ui";

export default async function NewRaffle({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "EDITOR");
  const campaigns = await db.campaign.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } });

  return (
    <>
      <PageHeader title="Nova rifa" back={{ href: `/orgs/${orgId}/raffles`, label: "Rifas" }} />
      <RaffleForm orgId={orgId} campaigns={campaigns} />
    </>
  );
}
