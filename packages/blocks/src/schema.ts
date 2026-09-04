import { z } from "zod";

/**
 * Block schema for the campaign page builder.
 * A Page stores `Block[]`. Every block is `{ id, type, props }` and is
 * validated with these Zod schemas before it is persisted or rendered.
 * Adding a block = add a schema here + an entry in registry.ts.
 */

const blockId = z.string().min(1).max(64);
const hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "must be a hex color");
const cents = z.number().int().nonnegative();

export const HeroBlock = z.object({
  id: blockId,
  type: z.literal("hero"),
  props: z.object({
    title: z.string().min(1).max(120),
    subtitle: z.string().max(240).optional(),
    backgroundImageUrl: z.string().url().optional(),
    overlay: z.number().min(0).max(1).default(0.4),
    ctaLabel: z.string().max(40).default("Doar agora"),
    ctaTarget: z.enum(["checkout", "url"]).default("checkout"),
    ctaUrl: z.string().url().optional(),
  }),
});

export const RichTextBlock = z.object({
  id: blockId,
  type: z.literal("richText"),
  props: z.object({
    // Stored as sanitized HTML — sanitization happens server-side before save.
    html: z.string().max(20_000),
    maxWidth: z.enum(["prose", "full"]).default("prose"),
  }),
});

export const ImageBlock = z.object({
  id: blockId,
  type: z.literal("image"),
  props: z.object({
    url: z.string().url(),
    alt: z.string().max(200).default(""),
    caption: z.string().max(200).optional(),
  }),
});

export const GalleryBlock = z.object({
  id: blockId,
  type: z.literal("gallery"),
  props: z.object({
    images: z.array(z.object({ url: z.string().url(), alt: z.string().max(200).default("") })).min(1).max(24),
    columns: z.number().int().min(1).max(4).default(3),
  }),
});

export const AmountOptionsBlock = z.object({
  id: blockId,
  type: z.literal("amountOptions"),
  props: z.object({
    amountsCents: z.array(cents.positive()).min(1).max(8),
    allowCustom: z.boolean().default(true),
    defaultIndex: z.number().int().nonnegative().default(1),
  }),
});

export const DonationCheckoutBlock = z.object({
  id: blockId,
  type: z.literal("donationCheckout"),
  props: z.object({
    methods: z.array(z.enum(["PIX", "CREDIT_CARD", "BOLETO"])).min(1).default(["PIX", "CREDIT_CARD", "BOLETO"]),
    allowRecurring: z.boolean().default(true),
    allowTip: z.boolean().default(true),
    tipLabel: z.string().max(120).default("Adicionar uma contribuição extra à causa"),
  }),
});

export const ProgressBarBlock = z.object({
  id: blockId,
  type: z.literal("progressBar"),
  props: z.object({
    showValues: z.boolean().default(true),
    showDonorsCount: z.boolean().default(true),
    accentColor: hex.optional(),
  }),
});

export const ImpactCountersBlock = z.object({
  id: blockId,
  type: z.literal("impactCounters"),
  props: z.object({
    items: z
      .array(z.object({ value: z.number(), suffix: z.string().max(16).default(""), label: z.string().max(60) }))
      .min(1)
      .max(4),
    animate: z.boolean().default(true),
  }),
});

export const TestimonialsBlock = z.object({
  id: blockId,
  type: z.literal("testimonials"),
  props: z.object({
    items: z
      .array(z.object({ quote: z.string().max(600), author: z.string().max(80), role: z.string().max(80).optional(), avatarUrl: z.string().url().optional() }))
      .min(1)
      .max(12),
  }),
});

export const FaqBlock = z.object({
  id: blockId,
  type: z.literal("faq"),
  props: z.object({
    items: z.array(z.object({ q: z.string().max(200), a: z.string().max(2000) })).min(1).max(30),
  }),
});

export const VideoEmbedBlock = z.object({
  id: blockId,
  type: z.literal("videoEmbed"),
  props: z.object({
    // Only known providers — no arbitrary iframe src.
    provider: z.enum(["youtube", "vimeo"]),
    videoId: z.string().regex(/^[A-Za-z0-9_-]{6,20}$/),
  }),
});

export const CtaBlock = z.object({
  id: blockId,
  type: z.literal("cta"),
  props: z.object({
    title: z.string().max(120),
    body: z.string().max(300).optional(),
    buttonLabel: z.string().max(40).default("Doar agora"),
    target: z.enum(["checkout", "url"]).default("checkout"),
    url: z.string().url().optional(),
  }),
});

export const DonorWallBlock = z.object({
  id: blockId,
  type: z.literal("donorWall"),
  props: z.object({
    limit: z.number().int().min(3).max(100).default(20),
    showAmount: z.boolean().default(false),
  }),
});

export const FooterBlock = z.object({
  id: blockId,
  type: z.literal("footer"),
  props: z.object({
    text: z.string().max(400).optional(),
    showPlatformBranding: z.boolean().default(true),
  }),
});

export const SponseeGridBlock = z.object({
  id: blockId,
  type: z.literal("sponseeGrid"),
  props: z.object({
    title: z.string().max(120).default("Escolha quem apadrinhar"),
    /** Optional category filter, e.g. "Criança". Empty = all. */
    category: z.string().max(40).optional(),
    columns: z.number().int().min(1).max(4).default(3),
    showStory: z.boolean().default(true),
  }),
});

export const RaffleWidgetBlock = z.object({
  id: blockId,
  type: z.literal("raffleWidget"),
  props: z.object({
    /** Which raffle this block sells. */
    raffleId: z.string().min(1),
    quickAmounts: z.array(z.number().int().positive()).max(6).default([1, 5, 10, 20]),
    allowPickNumbers: z.boolean().default(true),
  }),
});

export const EventTicketsBlock = z.object({
  id: blockId,
  type: z.literal("eventTickets"),
  props: z.object({
    /** Which event this block sells tickets for. */
    eventId: z.string().min(1),
    askAttendeeNames: z.boolean().default(false),
  }),
});

export const AuctionLotsBlock = z.object({
  id: blockId,
  type: z.literal("auctionLots"),
  props: z.object({
    /** Which auction this block shows lots for. */
    auctionId: z.string().min(1),
    columns: z.number().int().min(1).max(3).default(2),
  }),
});

export const IntlDonationBlock = z.object({
  id: blockId,
  type: z.literal("intlDonation"),
  props: z.object({
    title: z.string().max(120).default("Donate from abroad"),
    currencies: z.array(z.string().length(3)).min(1).max(6).default(["USD", "EUR"]),
    /** Suggested amounts in MAJOR units (applied to whichever currency). */
    suggestedAmounts: z.array(z.number().int().positive()).max(6).default([10, 25, 50, 100]),
  }),
});

export const ImageTextBlock = z.object({
  id: blockId,
  type: z.literal("imageText"),
  props: z.object({
    imageUrl: z.string().url(),
    imageAlt: z.string().max(200).default(""),
    imagePosition: z.enum(["left", "right"]).default("left"),
    title: z.string().max(120),
    body: z.string().max(1200),
    ctaLabel: z.string().max(40).optional(),
    ctaTarget: z.enum(["checkout", "url"]).default("checkout"),
    ctaUrl: z.string().url().optional(),
  }),
});

export const StepsBlock = z.object({
  id: blockId,
  type: z.literal("steps"),
  props: z.object({
    title: z.string().max(120).default("Como funciona"),
    items: z
      .array(z.object({ title: z.string().max(80), body: z.string().max(280).default("") }))
      .min(1)
      .max(6),
  }),
});

export const CountdownBlock = z.object({
  id: blockId,
  type: z.literal("countdown"),
  props: z.object({
    title: z.string().max(120).default("A campanha encerra em"),
    /** ISO date-time (local) the campaign closes. */
    deadline: z.string().min(1),
    endedLabel: z.string().max(120).default("A campanha foi encerrada"),
  }),
});

export const MatchBannerBlock = z.object({
  id: blockId,
  type: z.literal("matchBanner"),
  props: z.object({
    text: z.string().max(200).default("Toda doação é dobrada por um doador-parceiro"),
    detail: z.string().max(200).optional(),
    until: z.string().optional(), // optional ISO date shown as "até DD/MM"
  }),
});

export const AllocationBlock = z.object({
  id: blockId,
  type: z.literal("allocation"),
  props: z.object({
    title: z.string().max(120).default("Para onde vai sua doação"),
    items: z
      .array(z.object({ label: z.string().max(80), amountCents: cents.positive() }))
      .min(1)
      .max(8),
  }),
});

export const CampaignReportsBlock = z.object({
  id: blockId,
  type: z.literal("campaignReports"),
  props: z.object({
    title: z.string().max(120).default("Prestação de contas"),
  }),
});

export const RewardsBlock = z.object({
  id: blockId,
  type: z.literal("rewards"),
  props: z.object({
    title: z.string().max(120).default("Recompensas"),
  }),
});

export const AmbassadorLeaderboardBlock = z.object({
  id: blockId,
  type: z.literal("ambassadorLeaderboard"),
  props: z.object({
    title: z.string().max(120).default("Embaixadores"),
    limit: z.number().int().min(1).max(20).default(5),
    showJoinCta: z.boolean().default(true),
  }),
});

export const CampaignUpdatesBlock = z.object({
  id: blockId,
  type: z.literal("campaignUpdates"),
  props: z.object({
    title: z.string().max(120).default("Novidades da campanha"),
    limit: z.number().int().min(1).max(20).default(5),
  }),
});

export const EmbedBlock = z.object({
  id: blockId,
  type: z.literal("embed"),
  props: z.object({
    /** Any https URL; only allowlisted providers render (see resolveEmbed). */
    url: z.string().url(),
    ratio: z.enum(["16:9", "4:3", "1:1", "9:16"]).default("16:9"),
    caption: z.string().max(200).optional(),
  }),
});

export const PixKeyBlock = z.object({
  id: blockId,
  type: z.literal("pixKey"),
  props: z.object({
    title: z.string().max(120).default("Doe direto pelo Pix"),
    keyType: z.enum(["cnpj", "email", "phone", "random"]).default("cnpj"),
    keyValue: z.string().min(3).max(120),
    note: z.string().max(240).optional(),
  }),
});

export const Block = z.discriminatedUnion("type", [
  HeroBlock,
  RichTextBlock,
  ImageBlock,
  GalleryBlock,
  AmountOptionsBlock,
  DonationCheckoutBlock,
  SponseeGridBlock,
  RaffleWidgetBlock,
  EventTicketsBlock,
  AuctionLotsBlock,
  IntlDonationBlock,
  ProgressBarBlock,
  ImpactCountersBlock,
  TestimonialsBlock,
  FaqBlock,
  VideoEmbedBlock,
  CtaBlock,
  DonorWallBlock,
  FooterBlock,
  ImageTextBlock,
  StepsBlock,
  CountdownBlock,
  MatchBannerBlock,
  PixKeyBlock,
  EmbedBlock,
  CampaignUpdatesBlock,
  AllocationBlock,
  CampaignReportsBlock,
  RewardsBlock,
  AmbassadorLeaderboardBlock,
]);

export type Block = z.infer<typeof Block>;
export type BlockType = Block["type"];

export const PageBlocks = z
  .array(Block)
  .max(60)
  .superRefine((blocks, ctx) => {
    const ids = new Set<string>();
    for (const b of blocks) {
      if (ids.has(b.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate block id: ${b.id}` });
      }
      ids.add(b.id);
    }
  });

export type PageBlocks = z.infer<typeof PageBlocks>;

/** Every registered block type — for the permissive draft schema below. */
export const BLOCK_TYPE_VALUES = [
  "hero",
  "richText",
  "image",
  "gallery",
  "amountOptions",
  "donationCheckout",
  "sponseeGrid",
  "raffleWidget",
  "eventTickets",
  "auctionLots",
  "intlDonation",
  "progressBar",
  "impactCounters",
  "testimonials",
  "faq",
  "videoEmbed",
  "cta",
  "donorWall",
  "footer",
  "imageText",
  "steps",
  "countdown",
  "matchBanner",
  "pixKey",
  "embed",
  "campaignUpdates",
  "allocation",
  "campaignReports",
  "rewards",
  "ambassadorLeaderboard",
] as const satisfies readonly BlockType[];

/**
 * Loose schema for autosaving a work-in-progress page: it only checks the
 * envelope ({ id, type, props }) and unique ids, NOT the per-block prop
 * constraints. This keeps a half-configured block (empty raffleId, mid-typed
 * color) from freezing autosave for the whole page. Publishing still runs the
 * strict `PageBlocks`.
 */
export const PageBlocksDraft = z
  .array(
    z.object({
      id: blockId,
      type: z.enum(BLOCK_TYPE_VALUES),
      props: z.record(z.unknown()),
    }),
  )
  .max(60)
  .superRefine((blocks, ctx) => {
    const ids = new Set<string>();
    for (const b of blocks) {
      if (ids.has(b.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate block id: ${b.id}` });
      ids.add(b.id);
    }
  });

export type PageBlocksDraft = z.infer<typeof PageBlocksDraft>;

/** Parse+validate raw JSON from the DB or an API request. Throws ZodError. */
export function parseBlocks(input: unknown): PageBlocks {
  return PageBlocks.parse(input);
}

export function safeParseBlocks(input: unknown) {
  return PageBlocks.safeParse(input);
}
