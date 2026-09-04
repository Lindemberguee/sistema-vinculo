"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";
import type { CrmResult } from "./notes";

const CHANNELS = ["EMAIL", "WHATSAPP", "PHONE", "SMS"] as const;

const profileSchema = z.object({
  ownerUserId: z.string().optional().or(z.literal("")),
  preferredChannel: z.enum(CHANNELS).optional().or(z.literal("")),
  birthdate: z.string().optional().or(z.literal("")),
});

/** Set the relationship manager, preferred channel and birthdate on a donor. */
export async function updateDonorProfile(
  organizationId: string,
  donorId: string,
  _prev: CrmResult | null,
  formData: FormData,
): Promise<CrmResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "EDITOR");
    const donor = await db.donor.findFirst({ where: { id: donorId }, select: { id: true } });
    if (!donor) return { ok: false, error: "Doador não encontrado" };

    const parsed = profileSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "Dados inválidos" };

    let ownerUserId: string | null = null;
    if (parsed.data.ownerUserId) {
      const m = await db.membership.findFirst({
        where: { organizationId, userId: parsed.data.ownerUserId },
        select: { userId: true },
      });
      if (!m) return { ok: false, error: "Responsável precisa ser da equipe" };
      ownerUserId = m.userId;
    }

    const bd = parsed.data.birthdate ? new Date(parsed.data.birthdate) : null;

    await db.donor.update({
      where: { id: donorId },
      data: {
        ownerUserId,
        preferredChannel: parsed.data.preferredChannel || null,
        birthdate: bd && !Number.isNaN(bd.getTime()) ? bd : null,
      },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/donors/${donorId}`);
  return { ok: true };
}
