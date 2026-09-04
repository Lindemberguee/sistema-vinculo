import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { campaignCompleteness } from "@/server/campaigns/completeness";
import { CampaignStatusControls } from "@/components/CampaignStatusControls";
import { EssentialTab } from "@/components/campaign-editor/EssentialTab";
import { FundraisingTab } from "@/components/campaign-editor/FundraisingTab";
import { ImpactTab } from "@/components/campaign-editor/ImpactTab";
import { RewardsTab } from "@/components/campaign-editor/RewardsTab";
import { CommunicationTab } from "@/components/campaign-editor/CommunicationTab";
import { SettingsTab } from "@/components/campaign-editor/SettingsTab";
import { LinksTab } from "@/components/campaign-editor/LinksTab";
import { AmbassadorsTab } from "@/components/campaign-editor/AmbassadorsTab";
import { orgPublicOrigin } from "@/server/links/url";
import { PageHeader, LinkButton, cn } from "@/components/ui";

const TABS = [
  { key: "essencial", label: "Essencial" },
  { key: "arrecadacao", label: "Arrecadação" },
  { key: "impacto", label: "Impacto" },
  { key: "recompensas", label: "Recompensas" },
  { key: "comunicacao", label: "Comunicação" },
  { key: "links", label: "Links" },
  { key: "embaixadores", label: "Embaixadores" },
  { key: "ajustes", label: "Ajustes" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const reais = (n: number | null | undefined) => (n ? (n / 100).toString().replace(".", ",") : "");
const toLocalInput = (d: Date | null) =>
  d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

export default async function CampaignSettings({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; campaignId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId, campaignId } = await params;
  const sp = await searchParams;
  const { db } = await requireOrgAccessPage(orgId, "EDITOR");

  const c = await db.campaign.findFirst({
    where: { id: campaignId },
    select: {
      title: true,
      slug: true,
      slogan: true,
      category: true,
      summary: true,
      story: true,
      galleryMedia: true,
      type: true,
      status: true,
      goalCents: true,
      superGoalCents: true,
      minAmountCents: true,
      suggestedAmountsCents: true,
      allowRecurring: true,
      allowTip: true,
      endsAt: true,
      offPlatformCents: true,
      notifyEmails: true,
      hiddenFromDirectory: true,
      dedicationEnabled: true,
      allowAmbassadors: true,
      faq: true,
      showFaq: true,
      showUpdates: true,
      sdgGoals: true,
      impactBiome: true,
      impactFocus: true,
      budget: true,
      showBudget: true,
      updates: {
        orderBy: { publishedAt: "desc" },
        select: { id: true, title: true, publishedAt: true, notifiedAt: true },
      },
      reports: {
        orderBy: { publishedAt: "desc" },
        select: { id: true, title: true, url: true, publishedAt: true },
      },
      rewards: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, description: true, imageUrl: true, amountCents: true, quantity: true, claimed: true },
      },
      organization: {
        select: {
          slug: true,
          customDomains: { where: { verifiedAt: { not: null } }, take: 1, select: { host: true } },
        },
      },
      donationLinks: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          note: true,
          amountCents: true,
          suggestedAmountsCents: true,
          lockAmount: true,
          defaultRecurring: true,
          defaultCoverFee: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          utmContent: true,
          utmTerm: true,
          status: true,
          expiresAt: true,
          visits: true,
          donationsCount: true,
          raisedCents: true,
        },
      },
      ambassadors: {
        orderBy: [{ raisedCents: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          slug: true,
          name: true,
          email: true,
          headline: true,
          photoUrl: true,
          goalCents: true,
          status: true,
          donationsCount: true,
          raisedCents: true,
          createdAt: true,
        },
      },
    },
  });
  if (!c) notFound();

  const tabParam = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) ?? "essencial";
  const tab: TabKey = (TABS.find((t) => t.key === tabParam)?.key ?? "essencial") as TabKey;

  const media = Array.isArray(c.galleryMedia) ? (c.galleryMedia as { type: string; url: string }[]) : [];
  const publicOrigin = orgPublicOrigin({
    slug: c.organization.slug,
    customHost: c.organization.customDomains[0]?.host ?? null,
  });
  const completeness = campaignCompleteness({
    slogan: c.slogan,
    category: c.category,
    summary: c.summary,
    story: c.story,
    galleryMedia: media,
    goalCents: c.goalCents,
    superGoalCents: c.superGoalCents,
    endsAt: c.endsAt,
    notifyEmails: c.notifyEmails,
    faq: c.faq,
    updatesCount: c.updates.length,
    sdgGoals: c.sdgGoals,
    budget: c.budget,
    rewardsCount: c.rewards.length,
  });

  return (
    <>
      <PageHeader
        title={c.title}
        back={{ href: `/orgs/${orgId}/campaigns`, label: "Campanhas" }}
        actions={
          <LinkButton href={`/orgs/${orgId}/campaigns/${campaignId}/editor`} variant="secondary" size="sm">
            Editar página →
          </LinkButton>
        }
      />

      <div className="mb-5">
        <CampaignStatusControls orgId={orgId} campaignId={campaignId} status={c.status} />
      </div>

      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/orgs/${orgId}/campaigns/${campaignId}?tab=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              t.key === tab
                ? "border-brand-600 text-ink"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          {tab === "essencial" && (
            <EssentialTab
              orgId={orgId}
              campaignId={campaignId}
              initial={{
                title: c.title,
                slug: c.slug,
                slogan: c.slogan ?? "",
                category: c.category,
                summary: c.summary ?? "",
                story: c.story ?? "",
                galleryUrls: media.filter((m) => m.type === "image").map((m) => m.url).join("\n"),
                videoUrl: media.find((m) => m.type === "video")?.url ?? "",
              }}
            />
          )}
          {tab === "arrecadacao" && (
            <FundraisingTab
              orgId={orgId}
              campaignId={campaignId}
              initial={{
                type: c.type,
                goalReais: reais(c.goalCents),
                superGoalReais: reais(c.superGoalCents),
                minAmountReais: reais(c.minAmountCents) || "5",
                suggestedAmountsReais: c.suggestedAmountsCents.map((x) => reais(x)).join(", "),
                allowRecurring: c.allowRecurring,
                allowTip: c.allowTip,
                endsAt: toLocalInput(c.endsAt),
                offPlatformReais: reais(c.offPlatformCents),
              }}
            />
          )}
          {tab === "impacto" && (
            <ImpactTab
              orgId={orgId}
              campaignId={campaignId}
              initial={{
                sdgGoals: c.sdgGoals,
                impactBiome: c.impactBiome ?? "",
                impactFocus: c.impactFocus ?? "",
                budget: Array.isArray(c.budget) ? (c.budget as { label: string; amountCents: number }[]) : [],
                showBudget: c.showBudget,
                reports: c.reports.map((r) => ({
                  id: r.id,
                  title: r.title,
                  url: r.url,
                  publishedAt: r.publishedAt.toLocaleDateString("pt-BR"),
                })),
              }}
            />
          )}
          {tab === "recompensas" && (
            <RewardsTab
              orgId={orgId}
              campaignId={campaignId}
              rewards={c.rewards.map((r) => ({
                id: r.id,
                title: r.title,
                description: r.description ?? "",
                imageUrl: r.imageUrl ?? "",
                amountReais: reais(r.amountCents),
                quantity: r.quantity != null ? String(r.quantity) : "",
                claimed: r.claimed,
              }))}
            />
          )}
          {tab === "comunicacao" && (
            <CommunicationTab
              orgId={orgId}
              campaignId={campaignId}
              initial={{
                faq: Array.isArray(c.faq) ? (c.faq as { q: string; a: string }[]) : [],
                showFaq: c.showFaq,
                showUpdates: c.showUpdates,
                updates: c.updates.map((u) => ({
                  id: u.id,
                  title: u.title,
                  publishedAt: u.publishedAt.toLocaleDateString("pt-BR"),
                  notified: u.notifiedAt != null,
                })),
              }}
            />
          )}
          {tab === "links" && (
            <LinksTab
              orgId={orgId}
              campaignId={campaignId}
              publicOrigin={publicOrigin}
              links={c.donationLinks.map((l) => ({
                id: l.id,
                slug: l.slug,
                title: l.title,
                note: l.note ?? "",
                amountReais: reais(l.amountCents),
                suggestedAmountsReais: l.suggestedAmountsCents.map((x) => reais(x)).join(", "),
                lockAmount: l.lockAmount,
                defaultRecurring: l.defaultRecurring,
                defaultCoverFee: l.defaultCoverFee,
                utmSource: l.utmSource ?? "",
                utmMedium: l.utmMedium ?? "",
                utmCampaign: l.utmCampaign ?? "",
                utmContent: l.utmContent ?? "",
                utmTerm: l.utmTerm ?? "",
                status: l.status,
                expiresAt: toLocalInput(l.expiresAt),
                visits: l.visits,
                donationsCount: l.donationsCount,
                raisedCents: l.raisedCents,
              }))}
            />
          )}
          {tab === "embaixadores" && (
            <AmbassadorsTab
              orgId={orgId}
              campaignSlug={c.slug}
              publicOrigin={publicOrigin}
              allowAmbassadors={c.allowAmbassadors}
              ambassadors={c.ambassadors.map((a) => ({
                id: a.id,
                slug: a.slug,
                name: a.name,
                email: a.email,
                headline: a.headline ?? "",
                photoUrl: a.photoUrl ?? "",
                goalCents: a.goalCents,
                status: a.status,
                donationsCount: a.donationsCount,
                raisedCents: a.raisedCents,
              }))}
            />
          )}
          {tab === "ajustes" && (
            <SettingsTab
              orgId={orgId}
              campaignId={campaignId}
              initial={{
                notifyEmails: c.notifyEmails.join("\n"),
                hiddenFromDirectory: c.hiddenFromDirectory,
                dedicationEnabled: c.dedicationEnabled,
                allowAmbassadors: c.allowAmbassadors,
              }}
            />
          )}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="card p-4">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Preenchimento</span>
              <span className="text-sm font-semibold tabular-nums">{completeness.pct}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${completeness.pct}%` }} />
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {completeness.sections.map((s) => (
                <li key={s.key} className="flex items-center justify-between">
                  <Link
                    href={`/orgs/${orgId}/campaigns/${campaignId}?tab=${s.key}`}
                    className={cn("hover:underline", s.key === tab ? "font-medium text-ink" : "text-muted")}
                  >
                    {s.label}
                  </Link>
                  <span className={cn("tabular-nums text-xs", s.done === s.total ? "text-success" : "text-faint")}>
                    {s.done}/{s.total}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
