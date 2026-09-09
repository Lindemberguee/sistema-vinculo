import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma, parsePlanLimits } from "@donation/db";
import { safeParseBlocks } from "@donation/blocks";
import { resolveTenant } from "@/server/tenant";
import { BlockList } from "@/blocks/render";
import { defaultCampaignBlocks } from "@/blocks/default-page";
import type { RenderContext } from "@/blocks/context";
import { getOrgPublicPaymentInfo } from "@/server/payments/resolve";

// ISR — revalidated by tag on publish (revalidateTag(`page:${pageId}`)).
// Trackable donation links (/l/{slug}) forward here with `?ref=`; the checkout
// resolves those presets client-side so this page stays fully cacheable.
export const revalidate = 3600;

async function loadPage(hostParam: string, campaignSlug: string) {
  const tenant = await resolveTenant(decodeURIComponent(hostParam));
  if (!tenant || tenant.kind !== "site") return null;

  const campaign = await prisma.campaign.findUnique({
    where: { organizationId_slug: { organizationId: tenant.organizationId, slug: campaignSlug } },
    select: {
      id: true,
      slug: true,
      title: true,
      slogan: true,
      summary: true,
      story: true,
      coverImageUrl: true,
      galleryMedia: true,
      faq: true,
      showFaq: true,
      showUpdates: true,
      budget: true,
      showBudget: true,
      status: true,
      seo: true,
      raisedCents: true,
      offPlatformCents: true,
      goalCents: true,
      superGoalCents: true,
      donorsCount: true,
      minAmountCents: true,
      suggestedAmountsCents: true,
      allowRecurring: true,
      allowTip: true,
      dedicationEnabled: true,
      allowAmbassadors: true,
      organization: { select: { displayName: true, branding: true, planId: true } },
      page: { select: { id: true, publishedBlocks: true } },
      _count: { select: { rewards: true } },
    },
  });
  if (!campaign || campaign.status !== "PUBLISHED") return null;

  const plan = await prisma.plan.findUnique({
    where: { id: campaign.organization.planId },
    select: { limits: true },
  });
  const pay = await getOrgPublicPaymentInfo(tenant.organizationId);

  const ctx: RenderContext = {
    host: tenant.host,
    organizationId: tenant.organizationId,
    org: {
      displayName: campaign.organization.displayName,
      branding: (campaign.organization.branding ?? {}) as RenderContext["org"]["branding"],
    },
    campaign: {
      slug: campaign.slug,
      title: campaign.title,
      summary: campaign.summary,
      raisedCents: campaign.raisedCents + campaign.offPlatformCents,
      goalCents: campaign.goalCents,
      donorsCount: campaign.donorsCount,
      minAmountCents: campaign.minAmountCents,
      suggestedAmountsCents: campaign.suggestedAmountsCents,
      allowRecurring: campaign.allowRecurring,
      allowTip: campaign.allowTip,
      dedicationEnabled: campaign.dedicationEnabled,
      allowAmbassadors: campaign.allowAmbassadors,
    },
    pagarmePublicKey: pay.publicKey,
    platformFeeBps: 0,
    removeBranding: parsePlanLimits(plan?.limits).removeBranding,
  };

  return { campaign, ctx };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ host: string; campaignSlug: string }>;
}): Promise<Metadata> {
  const { host, campaignSlug } = await params;
  const data = await loadPage(host, campaignSlug);
  if (!data) return { title: "Campanha não encontrada" };
  const seo = (data.campaign.seo ?? {}) as { title?: string; description?: string; ogImageUrl?: string; noindex?: boolean };
  return {
    title: seo.title ?? data.campaign.title,
    description: seo.description ?? data.campaign.summary ?? undefined,
    openGraph: { images: seo.ogImageUrl ? [seo.ogImageUrl] : undefined },
    robots: seo.noindex ? { index: false } : undefined,
  };
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ host: string; campaignSlug: string }>;
}) {
  const { host, campaignSlug } = await params;
  const data = await loadPage(host, campaignSlug);
  if (!data) notFound();

  const parsed = safeParseBlocks(data.campaign.page?.publishedBlocks ?? []);
  const blocks =
    parsed.success && parsed.data.length > 0
      ? parsed.data
      : defaultCampaignBlocks({
          title: data.campaign.title,
          slogan: data.campaign.slogan,
          coverImageUrl: data.campaign.coverImageUrl,
          story: data.campaign.story,
          galleryMedia: data.campaign.galleryMedia,
          goalCents: data.campaign.goalCents,
          faq: data.campaign.faq,
          showFaq: data.campaign.showFaq,
          showUpdates: data.campaign.showUpdates,
          budget: data.campaign.budget,
          showBudget: data.campaign.showBudget,
          hasRewards: data.campaign._count.rewards > 0,
          allowAmbassadors: data.campaign.allowAmbassadors,
        });

  // Layout: a leading hero spans full width; a trailing footer block spans full
  // width. The donation checkout goes in a sticky right rail on lg+ ONLY when
  // there's enough narrative beside it — otherwise it centers under the hero so
  // a sparse page (raffle/auction-only) doesn't leave a huge empty column.
  const checkoutBlock = blocks.find((b) => b.type === "donationCheckout");
  const rest = blocks.filter((b) => b.type !== "donationCheckout");
  const heroBlock = rest[0]?.type === "hero" ? rest[0] : null;
  const footerBlock = rest.length && rest[rest.length - 1]!.type === "footer" ? rest[rest.length - 1]! : null;
  const bodyBlocks = rest.slice(heroBlock ? 1 : 0, footerBlock ? -1 : undefined);
  const twoColumn = Boolean(checkoutBlock) && bodyBlocks.length > 0;

  return (
    <main id="top" className="@container min-h-screen bg-surface">
      {heroBlock && <BlockList blocks={[heroBlock]} ctx={data.ctx} />}

      {twoColumn ? (
        <div className="mx-auto grid max-w-6xl gap-x-10 px-0 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-6">
          <div className="min-w-0">
            <BlockList blocks={bodyBlocks} ctx={data.ctx} />
          </div>
          <aside className="px-5 py-8 sm:px-6 lg:px-0 lg:py-10">
            <div className="lg:sticky lg:top-6">
              <BlockList blocks={[checkoutBlock!]} ctx={data.ctx} />
            </div>
          </aside>
        </div>
      ) : (
        <>
          <BlockList blocks={bodyBlocks} ctx={data.ctx} />
          {checkoutBlock && (
            <div className="mx-auto flex max-w-[32rem] justify-center px-5 py-8 sm:px-6 sm:py-10">
              <BlockList blocks={[checkoutBlock]} ctx={data.ctx} />
            </div>
          )}
        </>
      )}

      {footerBlock && <BlockList blocks={[footerBlock]} ctx={data.ctx} />}
    </main>
  );
}
