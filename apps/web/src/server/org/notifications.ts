"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";
import type { OrgResult } from "@/server/org/email-config";

const emailSchema = z.string().trim().toLowerCase().email();

export async function updateNotificationConfig(
  organizationId: string,
  _prev: OrgResult | null,
  formData: FormData,
): Promise<OrgResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "ADMIN");

    const rawRecipients = String(formData.get("recipients") ?? "")
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const recipients: string[] = [];
    for (const r of rawRecipients) {
      const parsed = emailSchema.safeParse(r);
      if (!parsed.success) return { ok: false, error: `E-mail inválido: ${r}` };
      if (!recipients.includes(parsed.data)) recipients.push(parsed.data);
    }
    if (recipients.length > 10) return { ok: false, error: "No máximo 10 e-mails." };

    const digestHour = Number(formData.get("digestHour"));
    if (!Number.isInteger(digestHour) || digestHour < 0 || digestHour > 23) {
      return { ok: false, error: "Hora do resumo inválida." };
    }

    const data = {
      recipients,
      kycChanges: formData.get("kycChanges") === "on",
      recurringFailed: formData.get("recurringFailed") === "on",
      dailyDigest: formData.get("dailyDigest") === "on",
      digestHour,
    };

    await db.organizationNotificationConfig.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/settings/notifications`);
  return { ok: true };
}
