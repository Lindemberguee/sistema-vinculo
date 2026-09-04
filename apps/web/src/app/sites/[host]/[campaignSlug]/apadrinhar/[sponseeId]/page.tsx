import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma, resolveOrgPublicKey } from "@donation/db";
import { formatBRL } from "@donation/shared";
import { resolveTenant } from "@/server/tenant";
import { DEFAULT_ACCENT } from "@/blocks/accent";
import { DonationCheckout } from "@/blocks/DonationCheckout";
import { PublicShell } from "@/components/public/PublicShell";
import { Alert } from "@/components/ui";

export const dynamic = "force-dynamic";

async function load(hostParam: string, campaignSlug: string, sponseeId: string) {
  const tenant = await resolveTenant(decodeURIComponent(hostParam));
  if (!tenant || tenant.kind !== "site") return null;

  const campaign = await prisma.campaign.findUnique({
    where: { organizationId_slug: { organizationId: tenant.organizationId, slug: campaignSlug } },
    select: {
      slug: true,
      status: true,
      allowTip: true,
      organization: { select: { displayName: true, branding: true, planId: true } },
    },
  });
  if (!campaign || campaign.status !== "PUBLISHED") return null;

  const sponsee = await prisma.sponsee.findFirst({
    where: { id: sponseeId, organizationId: tenant.organizationId },
    select: { id: true, name: true, category: true, story: true, photoUrl: true, birthYear: true, monthlyAmountCents: true, status: true },
  });
  if (!sponsee) return null;

  const plan = await prisma.plan.findUnique({
    where: { id: campaign.organization.planId },
    select: { platformFeeBps: true },
  });
  const branding = (campaign.organization.branding ?? {}) as { primaryColor?: string; logoUrl?: string };
  const pay = await resolveOrgPublicKey(tenant.organizationId);

  return {
    campaign,
    sponsee,
    org: {
      displayName: campaign.organization.displayName,
      logoUrl: branding.logoUrl ?? null,
      accent: branding.primaryColor ?? null,
    },
    accent: branding.primaryColor ?? DEFAULT_ACCENT,
    platformFeeBps: plan?.platformFeeBps ?? 490,
    pagarmePublicKey: pay.publicKey,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ host: string; campaignSlug: string; sponseeId: string }>;
}): Promise<Metadata> {
  const { host, campaignSlug, sponseeId } = await params;
  const data = await load(host, campaignSlug, sponseeId);
  return { title: data ? `Apadrinhar ${data.sponsee.name}` : "Apadrinhamento" };
}

export default async function SponsorPage({
  params,
}: {
  params: Promise<{ host: string; campaignSlug: string; sponseeId: string }>;
}) {
  const { host, campaignSlug, sponseeId } = await params;
  const data = await load(host, campaignSlug, sponseeId);
  if (!data) notFound();

  const { sponsee, campaign, accent, org } = data;
  const m = sponsee.monthlyAmountCents;
  const suggested = [m, Math.round(m * 1.5), m * 2, m * 3].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <PublicShell org={org} width="lg">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          {sponsee.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sponsee.photoUrl} alt={sponsee.name} className="mb-4 w-full rounded-xl object-cover" />
          )}
          <div className="eyebrow">
            {sponsee.category}
            {sponsee.birthYear ? ` · ${new Date().getFullYear() - sponsee.birthYear} anos` : ""}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{sponsee.name}</h1>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">{sponsee.story}</p>
          {sponsee.status !== "AVAILABLE" && (
            <div className="mt-3">
              <Alert tone="warn">
                {sponsee.name} já tem um padrinho — sua contribuição vira um apoio adicional.
              </Alert>
            </div>
          )}
        </div>

        <div className="flex justify-center md:justify-end">
          <DonationCheckout
            campaignSlug={campaign.slug}
            minAmountCents={Math.min(...suggested)}
            suggestedAmountsCents={suggested}
            methods={["PIX", "CREDIT_CARD"]}
            allowRecurring
            allowTip={campaign.allowTip}
            tipLabel="Quero cobrir a taxa da plataforma"
            platformFeeBps={data.platformFeeBps}
            pagarmePublicKey={data.pagarmePublicKey}
            accentColor={accent}
            sponseeId={sponsee.id}
            heading={`Apadrinhar ${sponsee.name}`}
          />
        </div>
      </div>
    </PublicShell>
  );
}
