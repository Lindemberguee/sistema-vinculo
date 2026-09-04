"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";

export interface OrgResult {
  ok: boolean;
  error?: string;
}

const schema = z.object({
  fromName: z.string().trim().max(78).optional().or(z.literal("")),
  replyTo: z.string().trim().email("E-mail de resposta inválido").optional().or(z.literal("")),
});

/** Sender identity for this org's e-mails (From display name + Reply-To). */
export async function updateOrgEmailSender(
  organizationId: string,
  _prev: OrgResult | null,
  formData: FormData,
): Promise<OrgResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "ADMIN");
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

    const fromName = (parsed.data.fromName || "").replace(/["\r\n,]/g, "").trim().slice(0, 78) || null;
    const replyTo = parsed.data.replyTo || null;

    await db.organizationEmailConfig.upsert({
      where: { organizationId },
      create: { organizationId, fromName, replyTo },
      update: { fromName, replyTo },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/settings`);
  return { ok: true };
}
