"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { SEGMENT_TRIGGER_KINDS, type EmailTemplateKind } from "@donation/emails";
import { buildDonorWhere, parseDonorFilters } from "@donation/db";
import { requireOrgAccess } from "@/server/auth-helpers";
import { enqueueAnnualStatements } from "@/server/queue";
import type { CrmResult } from "./notes";

const KIND_SET = new Set<string>(SEGMENT_TRIGGER_KINDS);

const ruleSchema = z.object({
  segmentId: z.string().min(1, "Escolha um segmento"),
  templateKind: z.string().refine((k) => KIND_SET.has(k), "Template inválido para gatilho"),
  delayDays: z.coerce.number().int().min(0).max(90),
  name: z.string().trim().max(80).optional().or(z.literal("")),
});

function path(orgId: string) {
  return `/panel/orgs/${orgId}/broadcasts/automations`;
}

export async function createSegmentAutomation(
  organizationId: string,
  input: z.input<typeof ruleSchema>,
): Promise<CrmResult> {
  try {
    const { db, userId } = await requireOrgAccess(organizationId, "ADMIN");
    const parsed = ruleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

    const seg = await db.donorSegment.findFirst({
      where: { id: parsed.data.segmentId, organizationId },
      select: { id: true, filters: true },
    });
    if (!seg) return { ok: false, error: "Segmento não encontrado" };

    await db.segmentAutomation.create({
      data: {
        organizationId,
        segmentId: parsed.data.segmentId,
        templateKind: parsed.data.templateKind as EmailTemplateKind,
        delayDays: parsed.data.delayDays,
        name: parsed.data.name || null,
        createdByUserId: userId,
      },
    });

    // Grandfather everyone currently in the segment — enteredAt=epoch so they
    // never trigger; only donors who enter after now will fire.
    const where = buildDonorWhere(organizationId, parseDonorFilters((seg.filters ?? {}) as Record<string, string>));
    const current = await db.donor.findMany({ where, take: 20_000, select: { id: true } });
    if (current.length > 0) {
      await db.segmentMembership.createMany({
        data: current.map((d) => ({ segmentId: seg.id, donorId: d.id, enteredAt: new Date(0) })),
        skipDuplicates: true,
      });
    }
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(path(organizationId));
  return { ok: true };
}

export async function updateSegmentAutomation(
  organizationId: string,
  automationId: string,
  input: { delayDays?: number; templateKind?: string },
): Promise<CrmResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "ADMIN");
    const data: { delayDays?: number; templateKind?: EmailTemplateKind } = {};
    if (input.delayDays != null) {
      const n = Number(input.delayDays);
      if (!Number.isInteger(n) || n < 0 || n > 90) return { ok: false, error: "Prazo inválido (0–90 dias)" };
      data.delayDays = n;
    }
    if (input.templateKind != null) {
      if (!KIND_SET.has(input.templateKind)) return { ok: false, error: "Template inválido" };
      data.templateKind = input.templateKind as EmailTemplateKind;
    }
    const r = await db.segmentAutomation.updateMany({ where: { id: automationId, organizationId }, data });
    if (r.count === 0) return { ok: false, error: "Regra não encontrada" };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(path(organizationId));
  return { ok: true };
}

export async function toggleSegmentAutomation(
  organizationId: string,
  automationId: string,
): Promise<CrmResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "ADMIN");
    const cur = await db.segmentAutomation.findFirst({
      where: { id: automationId, organizationId },
      select: { enabled: true },
    });
    if (!cur) return { ok: false, error: "Regra não encontrada" };
    await db.segmentAutomation.updateMany({
      where: { id: automationId, organizationId },
      data: { enabled: !cur.enabled },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(path(organizationId));
  return { ok: true };
}

export async function deleteSegmentAutomation(
  organizationId: string,
  automationId: string,
): Promise<CrmResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "ADMIN");
    await db.segmentAutomation.deleteMany({ where: { id: automationId, organizationId } });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(path(organizationId));
  return { ok: true };
}

const annualSchema = z.coerce.number().int().min(2020).max(new Date().getFullYear());

/** Fire the annual giving statement for a chosen year, right now. */
export async function sendAnnualStatements(organizationId: string, year: number): Promise<CrmResult> {
  try {
    await requireOrgAccess(organizationId, "ADMIN");
    const parsed = annualSchema.safeParse(year);
    if (!parsed.success) return { ok: false, error: "Ano inválido" };
    await enqueueAnnualStatements(parsed.data);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  return { ok: true };
}
