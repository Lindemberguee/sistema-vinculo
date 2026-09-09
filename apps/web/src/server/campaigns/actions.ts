"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma, withOrgContext } from "@donation/db";
import { PageBlocks, PageBlocksDraft, BLOCK_REGISTRY, type BlockType } from "@donation/blocks";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";
import { assertCampaignQuota, assertModule } from "@/server/billing/limits";
import { emitOutboundEvent } from "@/server/webhooks/emit";
import { enqueueCampaignUpdate } from "@/server/queue";
import { sanitizeRichText } from "@/blocks/sanitize";

/** Strip unsafe markup from every richText block before it is persisted. */
function sanitizeBlocks<T extends { type: string; props: Record<string, unknown> }>(blocks: T[]): T[] {
  return blocks.map((b) =>
    b.type === "richText" && typeof b.props.html === "string"
      ? { ...b, props: { ...b.props, html: sanitizeRichText(b.props.html) } }
      : b,
  );
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const reaisToCents = (s: string | undefined): number =>
  Math.round(Number((s ?? "").trim().replace(/\./g, "").replace(",", ".")) * 100);

const settingsSchema = z.object({
  title: z.string().min(3).max(120),
  slug: z.string().min(2).max(120).regex(slugRe, "Use apenas letras minúsculas, números e hífens"),
  summary: z.string().max(400).optional().or(z.literal("")),
  type: z.enum(["DONATION", "CROWDFUNDING", "APADRINHAMENTO", "EVENT"]),
  goalReais: z.string().optional(),
  minAmountReais: z.string(),
  suggestedAmountsCents: z.string(), // comma-separated reais, parsed below
  allowRecurring: z
    .union([z.literal("true"), z.literal("on"), z.literal("false"), z.null(), z.undefined()])
    .transform((v) => v === "true" || v === "on"),
  allowTip: z
    .union([z.literal("true"), z.literal("on"), z.literal("false"), z.null(), z.undefined()])
    .transform((v) => v === "true" || v === "on"),
  seoTitle: z.string().max(160).optional().or(z.literal("")),
  seoDescription: z.string().max(320).optional().or(z.literal("")),
});

function parseSuggested(input: string): number[] {
  return input
    .split(",")
    .map((s) => reaisToCents(s))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 8);
}

/** Shared: turn validated settings form data into the Campaign column values. */
function toCampaignData(d: z.infer<typeof settingsSchema>) {
  const min = reaisToCents(d.minAmountReais);
  const goal = d.goalReais ? reaisToCents(d.goalReais) : 0;
  return {
    title: d.title,
    slug: d.slug,
    summary: d.summary || null,
    type: d.type,
    goalCents: goal > 0 ? goal : null,
    minAmountCents: Number.isFinite(min) && min >= 100 ? min : 500,
    suggestedAmountsCents: parseSuggested(d.suggestedAmountsCents),
    allowRecurring: d.allowRecurring,
    allowTip: d.allowTip,
    seo: { title: d.seoTitle || undefined, description: d.seoDescription || undefined },
  };
}

/** Create a campaign (DRAFT) plus its empty Page. Redirects to the editor. */
export async function createCampaign(orgId: string, formData: FormData): Promise<ActionResult> {
  let campaignId: string;
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    await assertCampaignQuota(db, orgId);
    const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    const campaign = await db.campaign.create({
      data: { organizationId: orgId, status: "DRAFT", ...toCampaignData(parsed.data) },
      select: { id: true },
    });
    campaignId = campaign.id;

    await db.page.create({ data: { organizationId: orgId, campaignId, blocks: [] } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, fieldErrors: { slug: ["Já existe uma campanha com este endereço"] } };
    }
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }

  revalidatePath(`/panel/orgs/${orgId}/campaigns`);
  redirect(`/orgs/${orgId}/campaigns/${campaignId}/editor`);
}

/** `useActionState` adapter — bind orgId, pass to <form>. */
export async function createCampaignFormAction(
  orgId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return createCampaign(orgId, formData);
}

export async function updateCampaignFormAction(
  orgId: string,
  campaignId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return updateCampaignSettings(orgId, campaignId, formData);
}

export async function updateCampaignSettings(
  orgId: string,
  campaignId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    // tenantPrisma does not scope update-by-unique — verify ownership first.
    const existing = await db.campaign.findFirst({ where: { id: campaignId }, select: { id: true } });
    if (!existing) return { ok: false, error: "Campanha não encontrada" };

    await db.campaign.update({ where: { id: campaignId }, data: toCampaignData(parsed.data) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, fieldErrors: { slug: ["Endereço já usado por outra campanha"] } };
    }
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }

  revalidatePath(`/panel/orgs/${orgId}/campaigns/${campaignId}`);
  return { ok: true };
}

const seoSchema = z.object({
  title: z.string().max(160),
  description: z.string().max(320),
});

const themeSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
  buttonRadius: z.enum(["full", "md", "none"]),
});

/** Org-level visual identity edited from the Studio "Tema" tab. Merges into
 * Organization.branding so every campaign page picks it up. */
export async function saveOrgTheme(
  orgId: string,
  input: { primaryColor: string; buttonRadius: "full" | "md" | "none" },
): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = themeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Tema inválido" };

    const org = await db.organization.findFirst({ where: { id: orgId }, select: { branding: true } });
    if (!org) return { ok: false, error: "Organização não encontrada" };

    const branding = { ...((org.branding ?? {}) as Record<string, unknown>), ...parsed.data };
    await db.organization.update({ where: { id: orgId }, data: { branding: branding as Prisma.InputJsonValue } });
    revalidatePath("/sites/[host]/[campaignSlug]", "page");
    return { ok: true };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}

/** Patch just the SEO title/description from the Studio "Página" tab. */
export async function saveCampaignSeo(
  orgId: string,
  campaignId: string,
  input: { title: string; description: string },
): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = seoSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Texto muito longo" };

    const campaign = await db.campaign.findFirst({ where: { id: campaignId }, select: { seo: true } });
    if (!campaign) return { ok: false, error: "Campanha não encontrada" };

    const seo = { ...((campaign.seo ?? {}) as Record<string, unknown>) };
    seo.title = parsed.data.title || undefined;
    seo.description = parsed.data.description || undefined;

    await db.campaign.update({ where: { id: campaignId }, data: { seo: seo as Prisma.InputJsonValue } });
    revalidatePath("/sites/[host]/[campaignSlug]", "page");
    return { ok: true };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}

/** Autosave the draft blocks. Called (debounced) from the editor. Uses the loose
 * draft schema so a half-configured block doesn't freeze the whole page. */
export async function saveDraftBlocks(orgId: string, campaignId: string, rawBlocks: unknown): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = PageBlocksDraft.safeParse(rawBlocks);
    if (!parsed.success) return { ok: false, error: "O rascunho tem um formato inesperado e não foi salvo" };

    const page = await db.page.findFirst({ where: { campaignId }, select: { id: true } });
    if (!page) return { ok: false, error: "Página não encontrada" };

    const blocks = sanitizeBlocks(parsed.data);
    await db.page.update({ where: { id: page.id }, data: { blocks: blocks as Prisma.InputJsonValue } });
    return { ok: true };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}

/** Publish: copy draft -> live, snapshot a version, flip campaign to PUBLISHED, revalidate. */
export async function publishCampaign(orgId: string, campaignId: string): Promise<ActionResult> {
  let slug: string;
  try {
    const { db, userId } = await requireOrgAccess(orgId, "EDITOR");

    const org = await db.organization.findFirst({ where: { id: orgId }, select: { status: true } });
    if (org?.status !== "ACTIVE") {
      return { ok: false, error: "A organização precisa estar aprovada (KYC) para publicar campanhas." };
    }

    const campaign = await db.campaign.findFirst({
      where: { id: campaignId },
      select: { slug: true, page: { select: { id: true, blocks: true } } },
    });
    if (!campaign?.page) return { ok: false, error: "Campanha ou página não encontrada" };
    slug = campaign.slug;

    const draft = PageBlocksDraft.safeParse(campaign.page.blocks);
    const candidate = draft.success ? sanitizeBlocks(draft.data) : [];
    const validated = PageBlocks.safeParse(candidate);
    if (!validated.success) {
      const names = new Set<string>();
      for (const issue of validated.error.issues) {
        const idx = issue.path[0];
        const b = typeof idx === "number" ? candidate[idx] : undefined;
        if (b) names.add(BLOCK_REGISTRY[b.type as BlockType]?.label ?? String(b.type));
      }
      const list = [...names].join(", ");
      return {
        ok: false,
        error: list
          ? `Complete estes blocos antes de publicar: ${list}.`
          : "Há blocos incompletos. Revise a página antes de publicar.",
      };
    }

    await withOrgContext(orgId, (tx) =>
      Promise.all([
        tx.page.update({
          where: { id: campaign.page!.id },
          data: { publishedBlocks: validated.data as Prisma.InputJsonValue, publishedAt: new Date() },
        }),
        tx.pageVersion.create({
          data: { pageId: campaign.page!.id, blocks: validated.data as Prisma.InputJsonValue, createdBy: userId },
        }),
        tx.campaign.update({ where: { id: campaignId }, data: { status: "PUBLISHED" } }),
        tx.auditLog.create({
          data: {
            organizationId: orgId,
            userId,
            action: "page.published",
            entity: "Campaign",
            entityId: campaignId,
            diff: {} as Prisma.InputJsonValue,
          },
        }),
      ]),
    );
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }

  await emitOutboundEvent(orgId, "campaign.published", { campaignId, slug });

  // Public route is /sites/[host]/[campaignSlug]; revalidate the whole dynamic page.
  revalidatePath("/sites/[host]/[campaignSlug]", "page");
  revalidatePath(`/panel/orgs/${orgId}/campaigns/${campaignId}`);
  return { ok: true };
}

export async function setCampaignStatus(
  orgId: string,
  campaignId: string,
  status: "PAUSED" | "PUBLISHED" | "CLOSED",
): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const existing = await db.campaign.findFirst({ where: { id: campaignId }, select: { id: true } });
    if (!existing) return { ok: false, error: "Campanha não encontrada" };
    await db.campaign.update({ where: { id: campaignId }, data: { status } });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/sites/[host]/[campaignSlug]", "page");
  revalidatePath(`/panel/orgs/${orgId}/campaigns/${campaignId}`);
  return { ok: true };
}

const CATEGORY_VALUES = [
  "NONE",
  "CHILDREN",
  "HEALTH",
  "ENVIRONMENT",
  "HUMAN_RIGHTS",
  "ANIMALS",
  "EDUCATION",
  "SPORTS",
  "COMMUNITY",
  "ENTREPRENEURSHIP",
  "SPIRITUALITY",
  "CULTURE",
  "PUBLIC_POLICY",
] as const;

/** Load-then-write guard shared by the three tab actions below. */
async function loadCampaignOr404(db: Awaited<ReturnType<typeof requireOrgAccess>>["db"], campaignId: string) {
  const existing = await db.campaign.findFirst({ where: { id: campaignId }, select: { id: true } });
  if (!existing) throw new Error("Campanha não encontrada");
}

const essentialsSchema = z.object({
  title: z.string().min(3).max(120),
  slug: z.string().min(2).max(120).regex(slugRe, "Use apenas letras minúsculas, números e hífens"),
  slogan: z.string().max(120).optional().or(z.literal("")),
  category: z.enum(CATEGORY_VALUES),
  summary: z.string().max(400).optional().or(z.literal("")),
  story: z.string().max(20_000).optional().or(z.literal("")),
  galleryUrls: z.string().optional().or(z.literal("")), // one image URL per line
  videoUrl: z.string().url().optional().or(z.literal("")),
});

/** "Essencial" tab: identity, story, media. */
export async function saveCampaignEssentials(
  orgId: string,
  campaignId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = essentialsSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    await loadCampaignOr404(db, campaignId);

    const images = (parsed.data.galleryUrls ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6)
      .map((url) => ({ type: "image" as const, url }));
    const galleryMedia = parsed.data.videoUrl
      ? [...images, { type: "video" as const, url: parsed.data.videoUrl }]
      : images;

    await db.campaign.update({
      where: { id: campaignId },
      data: {
        title: parsed.data.title,
        slug: parsed.data.slug,
        slogan: parsed.data.slogan || null,
        category: parsed.data.category,
        summary: parsed.data.summary || null,
        story: parsed.data.story ? sanitizeRichText(parsed.data.story) : null,
        storyUpdatedAt: parsed.data.story ? new Date() : null,
        galleryMedia: galleryMedia as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, fieldErrors: { slug: ["Endereço já usado por outra campanha"] } };
    }
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/sites/[host]/[campaignSlug]", "page");
  revalidatePath(`/panel/orgs/${orgId}/campaigns/${campaignId}`);
  return { ok: true };
}

const fundraisingSchema = z.object({
  type: z.enum(["DONATION", "CROWDFUNDING", "APADRINHAMENTO", "EVENT"]),
  goalReais: z.string().optional().or(z.literal("")),
  superGoalReais: z.string().optional().or(z.literal("")),
  minAmountReais: z.string(),
  suggestedAmountsCents: z.string(),
  allowRecurring: z
    .union([z.literal("true"), z.literal("on"), z.null(), z.undefined()])
    .transform((v) => v === "true" || v === "on"),
  allowTip: z
    .union([z.literal("true"), z.literal("on"), z.null(), z.undefined()])
    .transform((v) => v === "true" || v === "on"),
  endsAt: z.string().optional().or(z.literal("")),
  offPlatformReais: z.string().optional().or(z.literal("")),
});

/** "Arrecadação" tab: goal, methods, dates. */
export async function saveCampaignFundraising(
  orgId: string,
  campaignId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = fundraisingSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    await loadCampaignOr404(db, campaignId);

    const min = reaisToCents(parsed.data.minAmountReais);
    const goal = parsed.data.goalReais ? reaisToCents(parsed.data.goalReais) : 0;
    const superGoal = parsed.data.superGoalReais ? reaisToCents(parsed.data.superGoalReais) : 0;
    const offPlatform = parsed.data.offPlatformReais ? reaisToCents(parsed.data.offPlatformReais) : 0;

    await db.campaign.update({
      where: { id: campaignId },
      data: {
        type: parsed.data.type,
        goalCents: goal > 0 ? goal : null,
        superGoalCents: superGoal > 0 ? superGoal : null,
        minAmountCents: Number.isFinite(min) && min >= 100 ? min : 500,
        suggestedAmountsCents: parseSuggested(parsed.data.suggestedAmountsCents),
        allowRecurring: parsed.data.allowRecurring,
        allowTip: parsed.data.allowTip,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        offPlatformCents: Number.isFinite(offPlatform) ? Math.max(0, offPlatform) : 0,
      },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/sites/[host]/[campaignSlug]", "page");
  revalidatePath(`/panel/orgs/${orgId}/campaigns/${campaignId}`);
  return { ok: true };
}

const bool = z
  .union([z.literal("true"), z.literal("on"), z.null(), z.undefined()])
  .transform((v) => v === "true" || v === "on");

const settingsExtraSchema = z.object({
  notifyEmails: z.string().optional().or(z.literal("")), // one per line
  hiddenFromDirectory: bool,
  dedicationEnabled: bool,
  allowAmbassadors: bool,
});

/** "Ajustes" tab: notifications + visibility. */
export async function saveCampaignSettingsExtra(
  orgId: string,
  campaignId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = settingsExtraSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    if (parsed.data.allowAmbassadors) await assertModule(orgId, "ambassadors");
    await loadCampaignOr404(db, campaignId);

    const notifyEmails = (parsed.data.notifyEmails ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
      .slice(0, 10);

    await db.campaign.update({
      where: { id: campaignId },
      data: {
        notifyEmails,
        hiddenFromDirectory: parsed.data.hiddenFromDirectory,
        dedicationEnabled: parsed.data.dedicationEnabled,
        allowAmbassadors: parsed.data.allowAmbassadors,
      },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${orgId}/campaigns/${campaignId}`);
  return { ok: true };
}

/* ── Comunicação: FAQ + Novidades ─────────────────────────────────── */

const faqItem = z.object({ q: z.string().max(200), a: z.string().max(2000) });
const communicationSchema = z.object({
  faq: z.string().optional().or(z.literal("")), // JSON string of faqItem[]
  showFaq: z
    .union([z.literal("true"), z.literal("on"), z.null(), z.undefined()])
    .transform((v) => v === "true" || v === "on"),
  showUpdates: z
    .union([z.literal("true"), z.literal("on"), z.null(), z.undefined()])
    .transform((v) => v === "true" || v === "on"),
});

export async function saveCampaignCommunication(
  orgId: string,
  campaignId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = communicationSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    await loadCampaignOr404(db, campaignId);

    let faq: { q: string; a: string }[] = [];
    if (parsed.data.faq) {
      const arr = z.array(faqItem).safeParse(JSON.parse(parsed.data.faq));
      if (!arr.success) return { ok: false, error: "FAQ inválido" };
      faq = arr.data.filter((x) => x.q.trim() && x.a.trim()).slice(0, 30);
    }

    await db.campaign.update({
      where: { id: campaignId },
      data: {
        faq: faq as Prisma.InputJsonValue,
        showFaq: parsed.data.showFaq,
        showUpdates: parsed.data.showUpdates,
      },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/sites/[host]/[campaignSlug]", "page");
  revalidatePath(`/panel/orgs/${orgId}/campaigns/${campaignId}`);
  return { ok: true };
}

const updateSchema = z.object({
  title: z.string().min(3).max(160),
  body: z.string().min(1).max(20_000),
  notify: z
    .union([z.literal("true"), z.literal("on"), z.null(), z.undefined()])
    .transform((v) => v === "true" || v === "on"),
});

export async function createCampaignUpdate(
  orgId: string,
  campaignId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { db, userId } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = updateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    await loadCampaignOr404(db, campaignId);

    const update = await db.campaignUpdate.create({
      data: {
        campaignId,
        organizationId: orgId,
        title: parsed.data.title,
        body: sanitizeRichText(parsed.data.body),
        createdBy: userId,
      },
      select: { id: true },
    });

    if (parsed.data.notify) {
      try {
        await enqueueCampaignUpdate(update.id);
      } catch (e) {
        console.error("enqueueCampaignUpdate failed:", e);
      }
    }
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/sites/[host]/[campaignSlug]", "page");
  revalidatePath(`/panel/orgs/${orgId}/campaigns/${campaignId}`);
  return { ok: true };
}

/* ── Impacto: ODS + bioma/foco + orçamento + prestação de contas ──── */

const budgetItem = z.object({ label: z.string().max(80), amountCents: z.number().int().nonnegative() });

export async function saveCampaignImpact(
  orgId: string,
  campaignId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    await loadCampaignOr404(db, campaignId);

    const sdgGoals = formData
      .getAll("sdgGoals")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 17);
    const impactBiome = (formData.get("impactBiome") as string | null)?.trim() || null;
    const impactFocus = (formData.get("impactFocus") as string | null)?.trim() || null;
    const showBudget = formData.get("showBudget") === "true" || formData.get("showBudget") === "on";

    let budget: { label: string; amountCents: number }[] = [];
    const raw = formData.get("budget") as string | null;
    if (raw) {
      const arr = z.array(budgetItem).safeParse(JSON.parse(raw));
      if (!arr.success) return { ok: false, error: "Orçamento inválido" };
      budget = arr.data.filter((x) => x.label.trim() && x.amountCents > 0).slice(0, 8);
    }

    await db.campaign.update({
      where: { id: campaignId },
      data: { sdgGoals, impactBiome, impactFocus, showBudget, budget: budget as Prisma.InputJsonValue },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/sites/[host]/[campaignSlug]", "page");
  revalidatePath(`/panel/orgs/${orgId}/campaigns/${campaignId}`);
  return { ok: true };
}

const reportSchema = z.object({
  title: z.string().min(2).max(160),
  url: z.string().url("Informe um link válido (https://…)"),
});

export async function createCampaignReport(
  orgId: string,
  campaignId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = reportSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    await loadCampaignOr404(db, campaignId);

    await db.campaignReport.create({
      data: { campaignId, organizationId: orgId, title: parsed.data.title, url: parsed.data.url },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/sites/[host]/[campaignSlug]", "page");
  revalidatePath(`/panel/orgs/${orgId}/campaigns/${campaignId}`);
  return { ok: true };
}

export async function deleteCampaignReport(orgId: string, reportId: string): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const existing = await db.campaignReport.findFirst({ where: { id: reportId }, select: { campaignId: true } });
    if (!existing) return { ok: false, error: "Relatório não encontrado" };
    await db.campaignReport.delete({ where: { id: reportId } });
    revalidatePath("/sites/[host]/[campaignSlug]", "page");
    revalidatePath(`/panel/orgs/${orgId}/campaigns/${existing.campaignId}`);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  return { ok: true };
}

/* ── Recompensas: cotas ───────────────────────────────────────────── */

const rewardSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(600).optional().or(z.literal("")),
  imageUrl: z.string().url().optional().or(z.literal("")),
  amountReais: z.string(),
  quantity: z.string().optional().or(z.literal("")), // "" = unlimited
});

function rewardData(d: z.infer<typeof rewardSchema>) {
  const amount = reaisToCents(d.amountReais);
  const qty = d.quantity ? Math.max(0, Math.round(Number(d.quantity))) : NaN;
  return {
    title: d.title,
    description: d.description || null,
    imageUrl: d.imageUrl || null,
    amountCents: Number.isFinite(amount) && amount >= 100 ? amount : 100,
    quantity: Number.isFinite(qty) && qty > 0 ? qty : null,
  };
}

export async function createCampaignReward(
  orgId: string,
  campaignId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = rewardSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    await loadCampaignOr404(db, campaignId);

    const count = await db.campaignReward.count({ where: { campaignId } });
    await db.campaignReward.create({
      data: { campaignId, organizationId: orgId, sortOrder: count, ...rewardData(parsed.data) },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/sites/[host]/[campaignSlug]", "page");
  revalidatePath(`/panel/orgs/${orgId}/campaigns/${campaignId}`);
  return { ok: true };
}

export async function updateCampaignReward(
  orgId: string,
  rewardId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = rewardSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    const existing = await db.campaignReward.findFirst({
      where: { id: rewardId },
      select: { campaignId: true },
    });
    if (!existing) return { ok: false, error: "Cota não encontrada" };

    await db.campaignReward.update({ where: { id: rewardId }, data: rewardData(parsed.data) });
    revalidatePath("/sites/[host]/[campaignSlug]", "page");
    revalidatePath(`/panel/orgs/${orgId}/campaigns/${existing.campaignId}`);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
  return { ok: true };
}

export async function deleteCampaignReward(orgId: string, rewardId: string): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const existing = await db.campaignReward.findFirst({
      where: { id: rewardId },
      select: { campaignId: true },
    });
    if (!existing) return { ok: false, error: "Cota não encontrada" };
    await db.campaignReward.delete({ where: { id: rewardId } });
    revalidatePath("/sites/[host]/[campaignSlug]", "page");
    revalidatePath(`/panel/orgs/${orgId}/campaigns/${existing.campaignId}`);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  return { ok: true };
}

export async function deleteCampaignUpdate(orgId: string, updateId: string): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const existing = await db.campaignUpdate.findFirst({
      where: { id: updateId },
      select: { campaignId: true },
    });
    if (!existing) return { ok: false, error: "Novidade não encontrada" };
    await db.campaignUpdate.delete({ where: { id: updateId } });
    revalidatePath("/sites/[host]/[campaignSlug]", "page");
    revalidatePath(`/panel/orgs/${orgId}/campaigns/${existing.campaignId}`);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  return { ok: true };
}
