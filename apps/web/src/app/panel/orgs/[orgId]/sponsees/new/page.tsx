import { requireOrgAccessPage } from "@/server/auth-helpers";
import { SponseeForm } from "@/components/SponseeForm";
import { PageHeader } from "@/components/ui";

export default async function NewSponsee({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "EDITOR");
  const campaigns = await db.campaign.findMany({
    where: { type: "APADRINHAMENTO" },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return (
    <>
      <PageHeader title="Novo afilhado" back={{ href: `/orgs/${orgId}/sponsees`, label: "Apadrinhamento" }} />
      <SponseeForm orgId={orgId} campaigns={campaigns} />
    </>
  );
}
