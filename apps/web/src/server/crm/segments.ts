"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";
import { assertModule } from "@/server/billing/limits";
import type { CrmResult } from "./notes";

/** Query-param keys allowed to be persisted in a saved segment. */
const ALLOWED = new Set(["q", "segment", "campaignId", "tag", "recurring", "minReais", "owner", "task", "smart", "sort", "view"]);

const nameSchema = z.string().trim().min(2, "Nome muito curto").max(40);

export async function saveDonorSegment(
  organizationId: string,
  name: string,
  rawFilters: Record<string, string>,
): Promise<CrmResult> {
  try {
    const { db, userId } = await requireOrgAccess(organizationId, "EDITOR");
    await assertModule(organizationId, "crm");
    const parsedName = nameSchema.parse(name);

    const filters: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawFilters ?? {})) {
      if (ALLOWED.has(k) && typeof v === "string" && v && k !== "page") filters[k] = v.slice(0, 200);
    }
    if (Object.keys(filters).length === 0) return { ok: false, error: "Aplique ao menos um filtro antes de salvar." };

    await db.donorSegment.upsert({
      where: { organizationId_name: { organizationId, name: parsedName } },
      create: { organizationId, name: parsedName, filters, createdByUserId: userId },
      update: { filters },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof z.ZodError) return { ok: false, error: err.issues[0]?.message ?? "Nome inválido" };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/donors`);
  return { ok: true };
}

export async function deleteDonorSegment(organizationId: string, segmentId: string): Promise<CrmResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "EDITOR");
    await db.donorSegment.deleteMany({ where: { id: segmentId, organizationId } });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/donors`);
  return { ok: true };
}
