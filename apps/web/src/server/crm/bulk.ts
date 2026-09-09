"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";
import { assertModule } from "@/server/billing/limits";
import type { CrmResult } from "./notes";

const MAX = 300;
const idList = z.array(z.string().min(1)).min(1).max(MAX);

async function scopedDonorIds(
  db: Awaited<ReturnType<typeof requireOrgAccess>>["db"],
  ids: string[],
): Promise<string[]> {
  const rows = await db.donor.findMany({ where: { id: { in: ids } }, select: { id: true } });
  return rows.map((r) => r.id);
}

export async function bulkAssignOwner(
  organizationId: string,
  donorIds: string[],
  ownerUserId: string,
): Promise<CrmResult & { count?: number }> {
  try {
    const { db } = await requireOrgAccess(organizationId, "EDITOR");
    await assertModule(organizationId, "crm");
    const ids = await scopedDonorIds(db, idList.parse(donorIds));
    if (ids.length === 0) return { ok: false, error: "Nenhum doador válido" };

    let owner: string | null = null;
    if (ownerUserId) {
      const m = await db.membership.findFirst({
        where: { organizationId, userId: ownerUserId },
        select: { userId: true },
      });
      if (!m) return { ok: false, error: "Responsável precisa ser da equipe" };
      owner = m.userId;
    }

    const r = await db.donor.updateMany({ where: { id: { in: ids } }, data: { ownerUserId: owner } });
    revalidatePath(`/panel/orgs/${organizationId}/donors`);
    return { ok: true, count: r.count };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}

export async function bulkAddTag(
  organizationId: string,
  donorIds: string[],
  rawTag: string,
): Promise<CrmResult & { count?: number }> {
  try {
    const { db } = await requireOrgAccess(organizationId, "EDITOR");
    await assertModule(organizationId, "crm");
    const tag = z.string().trim().min(1).max(40).parse(rawTag);
    const ids = await scopedDonorIds(db, idList.parse(donorIds));
    if (ids.length === 0) return { ok: false, error: "Nenhum doador válido" };

    await db.donorTag.createMany({
      data: ids.map((donorId) => ({ donorId, tag })),
      skipDuplicates: true,
    });
    revalidatePath(`/panel/orgs/${organizationId}/donors`);
    return { ok: true, count: ids.length };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}

const bulkTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  dueAt: z.string().optional(),
  assigneeUserId: z.string().optional().or(z.literal("")),
});

export async function bulkCreateTask(
  organizationId: string,
  donorIds: string[],
  input: z.input<typeof bulkTaskSchema>,
): Promise<CrmResult & { count?: number }> {
  try {
    const { db, userId } = await requireOrgAccess(organizationId, "EDITOR");
    await assertModule(organizationId, "crm");
    const parsed = bulkTaskSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    const ids = await scopedDonorIds(db, idList.parse(donorIds));
    if (ids.length === 0) return { ok: false, error: "Nenhum doador válido" };

    let assignee = userId;
    if (parsed.data.assigneeUserId) {
      const m = await db.membership.findFirst({
        where: { organizationId, userId: parsed.data.assigneeUserId },
        select: { userId: true },
      });
      if (m) assignee = m.userId;
    }
    const due = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;

    await db.donorTask.createMany({
      data: ids.map((donorId) => ({
        organizationId,
        donorId,
        title: parsed.data.title,
        dueAt: due && !Number.isNaN(due.getTime()) ? due : null,
        assigneeUserId: assignee,
        createdByUserId: userId,
      })),
    });
    revalidatePath(`/panel/orgs/${organizationId}/donors`);
    revalidatePath(`/panel/orgs/${organizationId}/tasks`);
    return { ok: true, count: ids.length };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}
