"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";
import { assertModule } from "@/server/billing/limits";

export interface CrmResult {
  ok: boolean;
  error?: string;
}

const KIND = ["NOTE", "CALL", "EMAIL", "MEETING", "WHATSAPP", "OTHER"] as const;

const noteSchema = z.object({
  kind: z.enum(KIND).default("NOTE"),
  body: z.string().trim().min(1, "Escreva algo").max(4000),
  happenedAt: z.string().optional(),
});

async function ensureDonor(db: Awaited<ReturnType<typeof requireOrgAccess>>["db"], donorId: string) {
  const donor = await db.donor.findFirst({ where: { id: donorId }, select: { id: true } });
  if (!donor) throw new Error("Doador não encontrado");
}

export async function addDonorNote(
  organizationId: string,
  donorId: string,
  _prev: CrmResult | null,
  formData: FormData,
): Promise<CrmResult> {
  try {
    const { db, userId } = await requireOrgAccess(organizationId, "EDITOR");
    await assertModule(organizationId, "crm");
    await ensureDonor(db, donorId);

    const parsed = noteSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const { kind, body, happenedAt } = parsed.data;
    const when = happenedAt ? new Date(happenedAt) : new Date();

    await db.donorNote.create({
      data: {
        organizationId,
        donorId,
        kind,
        body,
        happenedAt: Number.isNaN(when.getTime()) ? new Date() : when,
        createdByUserId: userId,
      },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/donors/${donorId}`);
  return { ok: true };
}

export async function toggleDonorNotePinned(organizationId: string, noteId: string): Promise<CrmResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "EDITOR");
    const note = await db.donorNote.findFirst({
      where: { id: noteId, organizationId },
      select: { id: true, donorId: true, pinned: true },
    });
    if (!note) return { ok: false, error: "Nota não encontrada" };
    await db.donorNote.update({ where: { id: note.id }, data: { pinned: !note.pinned } });
    revalidatePath(`/panel/orgs/${organizationId}/donors/${note.donorId}`);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  return { ok: true };
}

export async function deleteDonorNote(organizationId: string, noteId: string): Promise<CrmResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "EDITOR");
    const note = await db.donorNote.findFirst({
      where: { id: noteId, organizationId },
      select: { id: true, donorId: true },
    });
    if (!note) return { ok: false, error: "Nota não encontrada" };
    await db.donorNote.delete({ where: { id: note.id } });
    revalidatePath(`/panel/orgs/${organizationId}/donors/${note.donorId}`);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  return { ok: true };
}
