import { requireOrgAccessPage } from "@/server/auth-helpers";
import { CampaignForm } from "@/components/CampaignForm";
import { PageHeader } from "@/components/ui";

export default async function NewCampaign({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  await requireOrgAccessPage(orgId, "EDITOR");

  return (
    <>
      <PageHeader
        title="Nova campanha"
        description="Depois de criar você vai direto para o editor de página."
        back={{ href: `/orgs/${orgId}/campaigns`, label: "Campanhas" }}
      />
      <div className="max-w-xl rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <CampaignForm orgId={orgId} />
      </div>
    </>
  );
}
