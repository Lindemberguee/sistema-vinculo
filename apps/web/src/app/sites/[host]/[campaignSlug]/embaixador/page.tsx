import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@donation/db";
import { resolveTenant } from "@/server/tenant";
import { PublicShell } from "@/components/public/PublicShell";
import { AmbassadorJoinForm } from "@/components/ambassadors/AmbassadorJoinForm";

export const dynamic = "force-dynamic";

async function load(hostParam: string, campaignSlug: string) {
  const tenant = await resolveTenant(decodeURIComponent(hostParam));
  if (!tenant || tenant.kind !== "site") return null;

  const campaign = await prisma.campaign.findUnique({
    where: { organizationId_slug: { organizationId: tenant.organizationId, slug: campaignSlug } },
    select: {
      id: true,
      title: true,
      status: true,
      allowAmbassadors: true,
      organization: { select: { id: true, displayName: true, branding: true } },
    },
  });
  if (!campaign || campaign.status !== "PUBLISHED" || !campaign.allowAmbassadors) return null;

  const branding = (campaign.organization.branding ?? {}) as { primaryColor?: string; logoUrl?: string };
  const scheme = tenant.host.includes("localhost") ? "http" : "https";
  return {
    campaign,
    org: {
      displayName: campaign.organization.displayName,
      logoUrl: branding.logoUrl ?? null,
      accent: branding.primaryColor ?? null,
    },
    publicOrigin: `${scheme}://${tenant.host}`,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ host: string; campaignSlug: string }>;
}): Promise<Metadata> {
  const { host, campaignSlug } = await params;
  const data = await load(host, campaignSlug);
  return {
    title: data ? `Seja embaixador — ${data.campaign.title}` : "Embaixadores",
    robots: { index: false },
  };
}

export default async function AmbassadorJoinPage({
  params,
}: {
  params: Promise<{ host: string; campaignSlug: string }>;
}) {
  const { host, campaignSlug } = await params;
  const data = await load(host, campaignSlug);
  if (!data) notFound();

  return (
    <PublicShell org={data.org} width="md">
      <a href={`/${campaignSlug}`} className="text-sm text-muted hover:text-ink">
        ← Voltar para a campanha
      </a>
      <div className="mt-4">
        <AmbassadorJoinForm
          orgId={data.campaign.organization.id}
          campaignId={data.campaign.id}
          campaignTitle={data.campaign.title}
          publicOrigin={data.publicOrigin}
        />
      </div>
    </PublicShell>
  );
}
