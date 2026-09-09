import { notFound } from "next/navigation";
import { safeParseBlocksDraft } from "@donation/blocks";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { Studio } from "@/blocks/studio/Studio";
import type { EditorBlock } from "@/blocks/studio/studio-reducer";
import { DEFAULT_ACCENT } from "@/blocks/accent";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ orgId: string; campaignId: string }>;
}) {
  const { orgId, campaignId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "EDITOR");

  const campaign = await db.campaign.findFirst({
    where: { id: campaignId },
    select: {
      title: true,
      slug: true,
      seo: true,
      raisedCents: true,
      goalCents: true,
      donorsCount: true,
      organization: { select: { slug: true, branding: true } },
      page: { select: { blocks: true } },
    },
  });
  if (!campaign?.page) notFound();

  const parsed = safeParseBlocksDraft(campaign.page.blocks);
  const blocks = (parsed.success ? parsed.data : []) as unknown as EditorBlock[];

  const branding = (campaign.organization.branding ?? {}) as {
    primaryColor?: string;
    buttonRadius?: "full" | "md" | "none";
  };
  const seo = (campaign.seo ?? {}) as { title?: string; description?: string };

  return (
    <Studio
      orgId={orgId}
      campaignId={campaignId}
      campaignTitle={campaign.title}
      campaignSlug={campaign.slug}
      initialBlocks={blocks}
      campaignStats={{
        raisedCents: campaign.raisedCents,
        goalCents: campaign.goalCents,
        donorsCount: campaign.donorsCount,
      }}
      initialTheme={{ accent: branding.primaryColor ?? DEFAULT_ACCENT, radius: branding.buttonRadius ?? "full" }}
      seo={{ title: seo.title ?? "", description: seo.description ?? "" }}
      previewUrl={`/orgs/${orgId}/campaigns/${campaignId}/preview`}
      backUrl={`/orgs/${orgId}/campaigns/${campaignId}`}
    />
  );
}
