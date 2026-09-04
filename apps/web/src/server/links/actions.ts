"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@donation/db";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";
import { randomLinkSlug } from "./slug";
import type { ActionResult } from "@/server/campaigns/actions";

export type { ActionResult };

const reaisToCents = (s: string | undefined): number =>
  Math.round(Number((s ?? "").trim().replace(/\./g, "").replace(",", ".")) * 100);

/** Trim, drop control chars, cap length. UTM values are only ever shown as plain text. */
function cleanTag(v: string | undefined, max = 120): string | null {
  const s = (v ?? "")
    .split("")
    .filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127)
    .join("")
    .trim()
    .slice(0, max);
  return s || null;
}

function parseSuggested(input: string | undefined): number[] {
  return (input ?? "")
    .split(",")
    .map((s) => reaisToCents(s))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 6);
}

const bool = z
  .union([z.literal("true"), z.literal("on"), z.literal("false"), z.null(), z.undefined()])
  .transform((v) => v === "true" || v === "on");

const linkSchema = z.object({
  title: z.string().min(2, "Dê um nome ao link").max(80),
  note: z.string().max(280).optional().or(z.literal("")),
  amountReais: z.string().optional().or(z.literal("")),
  suggestedAmountsReais: z.string().optional().or(z.literal("")),
  lockAmount: bool,
  defaultRecurring: bool,
  defaultCoverFee: bool,
  expiresAt: z.string().optional().or(z.literal("")),
  utmSource: z.string().max(120).optional().or(z.literal("")),
  utmMedium: z.string().max(120).optional().or(z.literal("")),
  utmCampaign: z.string().max(120).optional().or(z.literal("")),
  utmContent: z.string().max(120).optional().or(z.literal("")),
  utmTerm: z.string().max(120).optional().or(z.literal("")),
});

function toLinkData(d: z.infer<typeof linkSchema>) {
  const amount = d.amountReais ? reaisToCents(d.amountReais) : NaN;
  const amountCents = Number.isFinite(amount) && amount >= 100 ? amount : null;
  const expiresAt = d.expiresAt ? new Date(d.expiresAt) : null;
  return {
    title: d.title.trim(),
    note: cleanTag(d.note, 280),
    amountCents,
    suggestedAmountsCents: parseSuggested(d.suggestedAmountsReais),
    lockAmount: d.lockAmount && amountCents != null,
    defaultRecurring: d.defaultRecurring,
    defaultCoverFee: d.defaultCoverFee,
    expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
    utmSource: cleanTag(d.utmSource),
    utmMedium: cleanTag(d.utmMedium),
    utmCampaign: cleanTag(d.utmCampaign),
    utmContent: cleanTag(d.utmContent),
    utmTerm: cleanTag(d.utmTerm),
  };
}

function revalidate(orgId: string, campaignId: string) {
  revalidatePath(`/panel/orgs/${orgId}/campaigns/${campaignId}`);
  revalidatePath("/sites/[host]/[campaignSlug]", "page");
}

export async function createDonationLink(
  orgId: string,
  campaignId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { db, userId } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = linkSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    const campaign = await db.campaign.findFirst({ where: { id: campaignId }, select: { id: true } });
    if (!campaign) return { ok: false, error: "Campanha não encontrada" };

    const data = toLinkData(parsed.data);

    // Retry a few times on the (very unlikely) slug collision.
    let lastErr: unknown;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await db.donationLink.create({
          data: { organizationId: orgId, campaignId, slug: randomLinkSlug(), createdBy: userId, ...data },
        });
        revalidate(orgId, campaignId);
        return { ok: true };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          lastErr = e;
          continue;
        }
        throw e;
      }
    }
    throw lastErr ?? new Error("Não foi possível gerar o link");
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
}

export async function updateDonationLink(
  orgId: string,
  linkId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = linkSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    const existing = await db.donationLink.findFirst({ where: { id: linkId }, select: { campaignId: true } });
    if (!existing) return { ok: false, error: "Link não encontrado" };

    await db.donationLink.update({ where: { id: linkId }, data: toLinkData(parsed.data) });
    revalidate(orgId, existing.campaignId);
    return { ok: true };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
}

export async function setDonationLinkStatus(
  orgId: string,
  linkId: string,
  status: "ACTIVE" | "PAUSED" | "ARCHIVED",
): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const existing = await db.donationLink.findFirst({ where: { id: linkId }, select: { campaignId: true } });
    if (!existing) return { ok: false, error: "Link não encontrado" };
    await db.donationLink.update({ where: { id: linkId }, data: { status } });
    revalidate(orgId, existing.campaignId);
    return { ok: true };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}

export async function deleteDonationLink(orgId: string, linkId: string): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const existing = await db.donationLink.findFirst({ where: { id: linkId }, select: { campaignId: true } });
    if (!existing) return { ok: false, error: "Link não encontrado" };
    await db.donationLink.delete({ where: { id: linkId } });
    revalidate(orgId, existing.campaignId);
    return { ok: true };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}
