import { safeParseBlocks, type Block } from "@donation/blocks";

export interface DefaultPageInput {
  title: string;
  slogan: string | null;
  coverImageUrl: string | null;
  story: string | null;
  galleryMedia: unknown;
  goalCents: number | null;
  faq?: unknown;
  showFaq?: boolean;
  showUpdates?: boolean;
  budget?: unknown;
  showBudget?: boolean;
  hasRewards?: boolean;
  allowAmbassadors?: boolean;
}

/**
 * A publishable page assembled straight from campaign fields, used when the org
 * hasn't opened the block builder yet. Matches the "campaign works without a
 * template" behaviour donors expect.
 */
export function defaultCampaignBlocks(c: DefaultPageInput): Block[] {
  const media = Array.isArray(c.galleryMedia) ? (c.galleryMedia as { type: string; url: string }[]) : [];
  const images = media.filter((m) => m.type === "image" && m.url).map((m) => ({ url: m.url, alt: "" }));
  const video = media.find((m) => m.type === "video" && m.url)?.url;
  const faq = Array.isArray(c.faq) ? (c.faq as { q: string; a: string }[]).filter((x) => x.q && x.a) : [];
  const budget = Array.isArray(c.budget)
    ? (c.budget as { label: string; amountCents: number }[]).filter((x) => x.label && x.amountCents > 0)
    : [];

  const raw: unknown[] = [
    {
      id: "default-hero",
      type: "hero",
      props: {
        title: c.title,
        ...(c.slogan ? { subtitle: c.slogan } : {}),
        ...(c.coverImageUrl ? { backgroundImageUrl: c.coverImageUrl } : {}),
        overlay: 0.45,
        ctaLabel: "Doar agora",
        ctaTarget: "checkout",
      },
    },
    ...(c.goalCents ? [{ id: "default-progress", type: "progressBar", props: { showValues: true, showDonorsCount: true } }] : []),
    ...(c.story ? [{ id: "default-story", type: "richText", props: { html: c.story, maxWidth: "prose" } }] : []),
    ...(images.length ? [{ id: "default-gallery", type: "gallery", props: { images, columns: images.length >= 3 ? 3 : images.length } }] : []),
    ...(video ? [{ id: "default-video", type: "embed", props: { url: video, ratio: "16:9" } }] : []),
    ...(c.hasRewards ? [{ id: "default-rewards", type: "rewards", props: { title: "Recompensas" } }] : []),
    {
      id: "default-checkout",
      type: "donationCheckout",
      props: { methods: ["PIX", "CREDIT_CARD", "BOLETO"], allowRecurring: true, allowTip: true },
    },
    ...(c.showBudget && budget.length
      ? [{ id: "default-allocation", type: "allocation", props: { title: "Para onde vai sua doação", items: budget } }]
      : []),
    ...(c.allowAmbassadors
      ? [{ id: "default-ambassadors", type: "ambassadorLeaderboard", props: { title: "Embaixadores", limit: 5, showJoinCta: true } }]
      : []),
    ...(c.showUpdates !== false
      ? [{ id: "default-updates", type: "campaignUpdates", props: { title: "Novidades da campanha", limit: 5 } }]
      : []),
    { id: "default-reports", type: "campaignReports", props: { title: "Prestação de contas" } },
    ...(c.showFaq !== false && faq.length
      ? [{ id: "default-faq", type: "faq", props: { items: faq } }]
      : []),
    { id: "default-footer", type: "footer", props: { showPlatformBranding: true } },
  ];

  const parsed = safeParseBlocks(raw);
  return parsed.success ? parsed.data : [];
}
