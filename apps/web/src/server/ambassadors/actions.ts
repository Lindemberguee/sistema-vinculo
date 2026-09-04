"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma, Prisma } from "@donation/db";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";
import { checkActionLimit, RATE_LIMIT_MESSAGE } from "@/server/rate-limit";
import { enqueueAmbassadorWelcome } from "@/server/queue";
import { randomSuffix, slugifyName } from "./slug";
import type { ActionResult } from "@/server/campaigns/actions";

export type { ActionResult };
export interface AmbassadorCreateResult extends ActionResult {
  slug?: string;
  manageToken?: string;
}

const reaisToCents = (s: string | undefined): number =>
  Math.round(Number((s ?? "").trim().replace(/\./g, "").replace(",", ".")) * 100);

/** Plain text only — headline/message are rendered escaped, never as HTML. */
function clean(v: string | undefined, max: number): string | null {
  const s = (v ?? "")
    .split("")
    .filter((c) => c.charCodeAt(0) >= 32 || c === "\n")
    .join("")
    .trim()
    .slice(0, max);
  return s || null;
}

const baseFields = {
  headline: z.string().max(120).optional().or(z.literal("")),
  message: z.string().max(2000).optional().or(z.literal("")),
  photoUrl: z.string().url().max(500).optional().or(z.literal("")),
  goalReais: z.string().optional().or(z.literal("")),
};

const createSchema = z.object({
  name: z.string().min(2, "Informe seu nome").max(80),
  email: z.string().email("E-mail inválido").max(160),
  ...baseFields,
});

const updateSchema = z.object(baseFields);

function fields(d: { headline?: string; message?: string; photoUrl?: string; goalReais?: string }) {
  const goal = d.goalReais ? reaisToCents(d.goalReais) : NaN;
  return {
    headline: clean(d.headline, 120),
    message: clean(d.message, 2000),
    photoUrl: d.photoUrl?.trim() || null,
    goalCents: Number.isFinite(goal) && goal >= 100 ? goal : null,
  };
}

/** Public, no auth: a supporter creates their own fundraising page for a campaign. */
export async function createAmbassador(
  orgId: string,
  campaignId: string,
  _prev: AmbassadorCreateResult | null,
  formData: FormData,
): Promise<AmbassadorCreateResult> {
  try {
    if (!(await checkActionLimit("ambassadorCreate"))) return { ok: false, error: RATE_LIMIT_MESSAGE };

    const parsed = createSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId: orgId },
      select: { id: true, slug: true, status: true, allowAmbassadors: true },
    });
    if (!campaign) return { ok: false, error: "Campanha não encontrada" };
    if (campaign.status !== "PUBLISHED" || !campaign.allowAmbassadors) {
      return { ok: false, error: "Esta campanha não está aceitando embaixadores." };
    }

    const email = parsed.data.email.toLowerCase().trim();

    // One page per person per campaign — return the existing one instead of a dup.
    const existing = await prisma.campaignAmbassador.findFirst({
      where: { campaignId, email, status: { not: "BLOCKED" } },
      select: { slug: true, manageToken: true, status: true },
    });
    if (existing) {
      return {
        ok: true,
        slug: existing.slug,
        manageToken: existing.manageToken,
        error: "Você já tem uma página nesta campanha — abrimos a que já existe.",
      };
    }

    const base = slugifyName(parsed.data.name);
    let created: { id: string; slug: string; manageToken: string } | null = null;
    for (let attempt = 0; attempt < 6 && !created; attempt += 1) {
      const slug = attempt === 0 ? base : `${base}-${randomSuffix()}`;
      try {
        created = await prisma.campaignAmbassador.create({
          data: {
            organizationId: orgId,
            campaignId,
            slug,
            name: parsed.data.name.trim(),
            email,
            ...fields(parsed.data),
          },
          select: { id: true, slug: true, manageToken: true },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
    if (!created) return { ok: false, error: "Não foi possível gerar o endereço da página. Tente outro nome." };

    try {
      await enqueueAmbassadorWelcome(created.id);
    } catch (e) {
      console.error("enqueueAmbassadorWelcome failed:", e);
    }

    revalidatePath(`/panel/orgs/${orgId}/campaigns/${campaignId}`);
    return { ok: true, slug: created.slug, manageToken: created.manageToken };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
}

/** Public, token-gated: the ambassador edits their own page. */
export async function updateAmbassador(
  token: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = updateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    const amb = await prisma.campaignAmbassador.findUnique({
      where: { manageToken: token },
      select: { id: true, organizationId: true, campaignId: true, status: true },
    });
    if (!amb || amb.status === "BLOCKED") return { ok: false, error: "Link inválido." };

    await prisma.campaignAmbassador.update({ where: { id: amb.id }, data: fields(parsed.data) });
    revalidatePath(`/panel/orgs/${amb.organizationId}/campaigns/${amb.campaignId}`);
    return { ok: true };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
}

/* ── Panel moderation (auth) ─────────────────────────────────────── */

export async function setAmbassadorStatus(
  orgId: string,
  ambassadorId: string,
  status: "ACTIVE" | "HIDDEN" | "BLOCKED",
): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const existing = await db.campaignAmbassador.findFirst({ where: { id: ambassadorId }, select: { campaignId: true } });
    if (!existing) return { ok: false, error: "Embaixador não encontrado" };
    await db.campaignAmbassador.update({ where: { id: ambassadorId }, data: { status } });
    revalidatePath(`/panel/orgs/${orgId}/campaigns/${existing.campaignId}`);
    return { ok: true };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}

export async function deleteAmbassador(orgId: string, ambassadorId: string): Promise<ActionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const existing = await db.campaignAmbassador.findFirst({ where: { id: ambassadorId }, select: { campaignId: true } });
    if (!existing) return { ok: false, error: "Embaixador não encontrado" };
    await db.campaignAmbassador.delete({ where: { id: ambassadorId } });
    revalidatePath(`/panel/orgs/${orgId}/campaigns/${existing.campaignId}`);
    return { ok: true };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}
