"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAppError, WEBHOOK_EVENTS } from "@donation/shared";
import { assertSafeOutboundUrl, UnsafeUrlError } from "@donation/shared/ssrf";
import { requireOrgAccess } from "@/server/auth-helpers";

export interface WebhookResult {
  ok: boolean;
  error?: string;
}

const createSchema = z.object({
  url: z.string().url().refine((u) => u.startsWith("https://"), "A URL precisa ser https"),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "Selecione ao menos um evento"),
});

export async function createOutboundWebhook(
  organizationId: string,
  input: z.input<typeof createSchema>,
): Promise<WebhookResult & { secret?: string }> {
  try {
    const { db } = await requireOrgAccess(organizationId, "ADMIN");
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

    // SSRF guard: the worker will POST to this URL from inside our network, so
    // reject anything that resolves to a private/loopback address.
    try {
      await assertSafeOutboundUrl(parsed.data.url);
    } catch (err) {
      if (err instanceof UnsafeUrlError) return { ok: false, error: err.message };
      throw err;
    }

    const secret = `whsec_${randomBytes(24).toString("hex")}`;
    await db.outboundWebhook.create({
      data: { organizationId, url: parsed.data.url, events: parsed.data.events, secret, active: true },
    });
    revalidatePath(`/panel/orgs/${organizationId}/webhooks`);
    return { ok: true, secret };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}

export async function setOutboundWebhookActive(
  organizationId: string,
  id: string,
  active: boolean,
): Promise<WebhookResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "ADMIN");
    const hook = await db.outboundWebhook.findFirst({ where: { id }, select: { id: true } });
    if (!hook) return { ok: false, error: "Webhook não encontrado" };
    await db.outboundWebhook.updateMany({ where: { id }, data: { active } });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/webhooks`);
  return { ok: true };
}

export async function deleteOutboundWebhook(organizationId: string, id: string): Promise<WebhookResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "ADMIN");
    const hook = await db.outboundWebhook.findFirst({ where: { id }, select: { id: true } });
    if (!hook) return { ok: false, error: "Webhook não encontrado" };
    await db.outboundWebhook.deleteMany({ where: { id } });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/webhooks`);
  return { ok: true };
}
