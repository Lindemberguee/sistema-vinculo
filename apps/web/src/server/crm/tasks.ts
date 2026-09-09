"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";
import { assertModule } from "@/server/billing/limits";
import type { CrmResult } from "./notes";

const taskSchema = z.object({
  title: z.string().trim().min(1, "Descreva a tarefa").max(200),
  details: z.string().trim().max(2000).optional().or(z.literal("")),
  dueAt: z.string().optional(),
  assigneeUserId: z.string().optional().or(z.literal("")),
});

/** Assignee must be a member of the org. Returns the id, or null if invalid/blank. */
async function validAssignee(
  db: Awaited<ReturnType<typeof requireOrgAccess>>["db"],
  organizationId: string,
  raw: string | undefined,
): Promise<string | null> {
  if (!raw) return null;
  const m = await db.membership.findFirst({
    where: { organizationId, userId: raw },
    select: { userId: true },
  });
  return m?.userId ?? null;
}

export async function createDonorTask(
  organizationId: string,
  donorId: string,
  _prev: CrmResult | null,
  formData: FormData,
): Promise<CrmResult> {
  try {
    const { db, userId } = await requireOrgAccess(organizationId, "EDITOR");
    await assertModule(organizationId, "crm");
    const donor = await db.donor.findFirst({ where: { id: donorId }, select: { id: true } });
    if (!donor) return { ok: false, error: "Doador não encontrado" };

    const parsed = taskSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

    const dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;
    await db.donorTask.create({
      data: {
        organizationId,
        donorId,
        title: parsed.data.title,
        details: parsed.data.details || null,
        dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
        assigneeUserId: (await validAssignee(db, organizationId, parsed.data.assigneeUserId || undefined)) ?? userId,
        createdByUserId: userId,
      },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/donors/${donorId}`);
  revalidatePath(`/panel/orgs/${organizationId}/tasks`);
  return { ok: true };
}

export async function toggleDonorTaskDone(organizationId: string, taskId: string): Promise<CrmResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "EDITOR");
    const task = await db.donorTask.findFirst({
      where: { id: taskId, organizationId },
      select: { id: true, donorId: true, doneAt: true },
    });
    if (!task) return { ok: false, error: "Tarefa não encontrada" };
    await db.donorTask.update({
      where: { id: task.id },
      data: { doneAt: task.doneAt ? null : new Date() },
    });
    revalidatePath(`/panel/orgs/${organizationId}/donors/${task.donorId}`);
    revalidatePath(`/panel/orgs/${organizationId}/tasks`);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  return { ok: true };
}

export async function deleteDonorTask(organizationId: string, taskId: string): Promise<CrmResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "EDITOR");
    const task = await db.donorTask.findFirst({
      where: { id: taskId, organizationId },
      select: { id: true, donorId: true },
    });
    if (!task) return { ok: false, error: "Tarefa não encontrada" };
    await db.donorTask.delete({ where: { id: task.id } });
    revalidatePath(`/panel/orgs/${organizationId}/donors/${task.donorId}`);
    revalidatePath(`/panel/orgs/${organizationId}/tasks`);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  return { ok: true };
}
