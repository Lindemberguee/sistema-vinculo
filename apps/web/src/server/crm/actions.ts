"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";
import { enqueueExport, enqueueRfm } from "@/server/queue";

export interface CrmResult {
  ok: boolean;
  error?: string;
}

const exportSchema = z.object({
  kind: z.enum(["donors", "donations"]),
  from: z.string().optional(),
  to: z.string().optional(),
  campaignId: z.string().optional(),
  method: z.enum(["PIX", "CREDIT_CARD", "BOLETO"]).optional(),
  status: z.enum(["CREATED", "PENDING", "PAID", "FAILED", "EXPIRED", "REFUNDED", "CHARGED_BACK"]).optional(),
  recurring: z.boolean().optional(),
});

export async function requestExport(
  organizationId: string,
  input: z.input<typeof exportSchema>,
): Promise<CrmResult & { exportId?: string }> {
  try {
    const { db, userId } = await requireOrgAccess(organizationId, "FINANCE");
    const parsed = exportSchema.parse(input);

    const row = await db.export.create({
      data: {
        organizationId,
        kind: parsed.kind,
        status: "PENDING",
        filters: parsed,
        createdBy: userId,
      },
      select: { id: true },
    });

    await enqueueExport(row.id);
    revalidatePath(`/panel/orgs/${organizationId}/exports`);
    return { ok: true, exportId: row.id };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}

const tagSchema = z.string().trim().min(1).max(40);

export async function addDonorTag(organizationId: string, donorId: string, rawTag: string): Promise<CrmResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "EDITOR");
    const tag = tagSchema.parse(rawTag);

    const donor = await db.donor.findFirst({ where: { id: donorId }, select: { id: true } });
    if (!donor) return { ok: false, error: "Doador não encontrado" };

    await db.donorTag.upsert({
      where: { donorId_tag: { donorId, tag } },
      create: { donorId, tag },
      update: {},
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/donors/${donorId}`);
  return { ok: true };
}

export async function removeDonorTag(organizationId: string, donorId: string, tag: string): Promise<CrmResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "EDITOR");
    const donor = await db.donor.findFirst({ where: { id: donorId }, select: { id: true } });
    if (!donor) return { ok: false, error: "Doador não encontrado" };
    await db.donorTag.deleteMany({ where: { donorId, tag } });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/donors/${donorId}`);
  return { ok: true };
}

/** Recompute RFM segments for this org now (nightly job covers everyone). */
export async function triggerRfm(organizationId: string): Promise<CrmResult> {
  try {
    await requireOrgAccess(organizationId, "FINANCE");
    await enqueueRfm(organizationId);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  return { ok: true };
}
