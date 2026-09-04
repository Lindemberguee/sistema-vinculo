import { requireOrgAccessPage } from "@/server/auth-helpers";
import { AuctionForm } from "@/components/AuctionForm";
import { PageHeader } from "@/components/ui";

export default async function NewAuction({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "EDITOR");
  const campaigns = await db.campaign.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } });
  return (
    <>
      <PageHeader title="Novo leilão" back={{ href: `/orgs/${orgId}/auctions`, label: "Leilões" }} />
      <AuctionForm orgId={orgId} campaigns={campaigns} />
    </>
  );
}
