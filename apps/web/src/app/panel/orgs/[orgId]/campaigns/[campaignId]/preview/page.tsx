import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { safeParseBlocks } from "@donation/blocks";
import { resolveOrgPublicKey, parsePlanLimits } from "@donation/db";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { BlockList } from "@/blocks/render";
import { defaultCampaignBlocks } from "@/blocks/default-page";
import type { RenderContext } from "@/blocks/context";

export const dynamic = "force-dynamic";

/** In-panel preview of the DRAFT blocks (page.blocks), not the published ones. */
export default async function DraftPreview({ params }: { params: Promise<{ orgId: string; campaignId: string }> }) {
  const { orgId, campaignId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "VIEWER");

  const c = await db.campaign.findFirst({
    where: { id: campaignId },
    select: {
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
      raisedCents: true,
      offPlatformCents: true,
      goalCents: true,
      donorsCount: true,
      minAmountCents: true,
      suggestedAmountsCents: true,
      allowRecurring: true,
      allowTip: true,
      dedicationEnabled: true,
      allowAmbassadors: true,
      organization: { select: { displayName: true, branding: true, planId: true } },
      page: { select: { blocks: true } },
      _count: { select: { rewards: true } },
    },
  });
  if (!c?.page) notFound();

  const plan = await db.plan.findUnique({
    where: { id: c.organization.planId },
    select: { limits: true },
  });
  const pay = await resolveOrgPublicKey(orgId);
  const parsed = safeParseBlocks(c.page.blocks);
  const blocks =
    parsed.success && parsed.data.length > 0
      ? parsed.data
      : defaultCampaignBlocks({
          title: c.title,
          slogan: c.slogan,
          coverImageUrl: c.coverImageUrl,
          story: c.story,
          galleryMedia: c.galleryMedia,
          goalCents: c.goalCents,
          faq: c.faq,
          showFaq: c.showFaq,
          showUpdates: c.showUpdates,
          budget: c.budget,
          showBudget: c.showBudget,
          hasRewards: c._count.rewards > 0,
          allowAmbassadors: c.allowAmbassadors,
        });

  const ctx: RenderContext = {
    host: "preview",
    organizationId: orgId,
    org: {
      displayName: c.organization.displayName,
      branding: (c.organization.branding ?? {}) as RenderContext["org"]["branding"],
    },
    campaign: {
      slug: c.slug,
      title: c.title,
      summary: c.summary,
      raisedCents: c.raisedCents + c.offPlatformCents,
      goalCents: c.goalCents,
      donorsCount: c.donorsCount,
      minAmountCents: c.minAmountCents,
      suggestedAmountsCents: c.suggestedAmountsCents,
      allowRecurring: c.allowRecurring,
      allowTip: c.allowTip,
      dedicationEnabled: c.dedicationEnabled,
      allowAmbassadors: c.allowAmbassadors,
    },
    pagarmePublicKey: pay.publicKey,
    platformFeeBps: 0,
    removeBranding: parsePlanLimits(plan?.limits).removeBranding,
  };

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8">
      <header className="sticky top-0 z-20 flex min-h-14 flex-wrap items-center gap-2 border-b border-line bg-surface/95 px-3 py-2 backdrop-blur sm:px-5">
        <Link
          href={`/orgs/${orgId}/campaigns/${campaignId}/editor`}
          className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-medium text-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <ArrowLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">Voltar ao editor</span>
          <span className="sm:hidden">Editor</span>
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{c.title}</h1>
        <span className="inline-flex min-h-7 items-center rounded-full bg-warn-bg px-2.5 text-xs font-medium text-warn">
          Rascunho
        </span>
        <Link href={`/orgs/${orgId}/campaigns/${campaignId}/editor`} className="btn-secondary btn-sm no-underline">
          <Pencil className="size-3.5" aria-hidden /> Editar
        </Link>
      </header>
      <div className="bg-warn-bg px-4 py-2 text-center text-xs text-warn sm:text-sm">
        Esta é uma pré-visualização do rascunho. Nenhuma doação, inscrição ou lance será processado.{" "}
        {parsed.success ? "" : "⚠️ Há blocos inválidos que serão ignorados."}
      </div>
      <section aria-label="Pré-visualização da campanha" className="@container bg-surface">
        <BlockList blocks={blocks} ctx={ctx} />
      </section>
    </div>
  );
}
