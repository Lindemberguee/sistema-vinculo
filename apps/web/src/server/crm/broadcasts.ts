"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { buildDonorWhere, parseDonorFilters } from "@donation/db";
import { requireOrgAccess } from "@/server/auth-helpers";
import { assertModule } from "@/server/billing/limits";
import { enqueueBroadcast } from "@/server/queue";
import type { CrmResult } from "./notes";

const ALLOWED = new Set(["q", "segment", "campaignId", "tag", "recurring", "minReais", "owner", "task", "smart", "view"]);

function cleanFilters(raw: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (ALLOWED.has(k) && typeof v === "string" && v) out[k] = v.slice(0, 200);
  }
  return out;
}

const composeSchema = z.object({
  name: z.string().trim().max(80).optional().or(z.literal("")),
  subject: z.string().trim().min(3, "Assunto muito curto").max(150),
  bodyText: z.string().trim().min(5, "Escreva a mensagem").max(8000),
});

const MIN_SCHEDULE_LEAD_MS = 60_000; // at least a minute out

/** Parse a datetime-local / ISO string into a future Date, or return an error string. */
function parseSchedule(raw: string | undefined | null): { at: Date } | { error: string } | null {
  if (!raw || !raw.trim()) return null;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return { error: "Data de agendamento inválida." };
  if (at.getTime() < Date.now() + MIN_SCHEDULE_LEAD_MS) return { error: "Escolha um horário no futuro." };
  return { at };
}

/** Recipient count for a filter (respecting opt-out). Also used by the preview. */
function recipientWhere(organizationId: string, filters: Record<string, string>) {
  const f = parseDonorFilters(filters);
  return {
    ...buildDonorWhere(organizationId, f),
    NOT: { consent: { path: ["email"], equals: false } },
  };
}

export async function createBroadcast(
  organizationId: string,
  input: z.input<typeof composeSchema> & {
    filters?: Record<string, string>;
    send?: boolean;
    scheduledAt?: string;
  },
): Promise<CrmResult & { id?: string }> {
  let created: { id: string } | null = null;
  try {
    const { db, userId } = await requireOrgAccess(organizationId, "ADMIN");
    await assertModule(organizationId, "crm");
    const parsed = composeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

    const schedule = parseSchedule(input.scheduledAt);
    if (schedule && "error" in schedule) return { ok: false, error: schedule.error };
    const scheduledAt = schedule ? schedule.at : null;

    const filters = cleanFilters(input.filters);
    const recipientCount = await db.donor.count({ where: recipientWhere(organizationId, filters) });
    if ((input.send || scheduledAt) && recipientCount === 0)
      return { ok: false, error: "Nenhum destinatário para esse filtro." };

    const status = scheduledAt ? "SCHEDULED" : input.send ? "SENDING" : "DRAFT";
    created = await db.donorBroadcast.create({
      data: {
        organizationId,
        name: parsed.data.name || null,
        subject: parsed.data.subject,
        bodyText: parsed.data.bodyText,
        filters,
        recipientCount,
        status,
        scheduledAt,
        createdByUserId: userId,
      },
      select: { id: true },
    });

    if (status === "SENDING") await enqueueBroadcast(created.id);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/broadcasts`);
  if (created) redirect(`/orgs/${organizationId}/broadcasts`);
  return { ok: true, id: created ? (created as { id: string }).id : undefined };
}

export async function sendExistingBroadcast(organizationId: string, broadcastId: string): Promise<CrmResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "ADMIN");
    await assertModule(organizationId, "crm");
    const b = await db.donorBroadcast.findFirst({
      where: { id: broadcastId, organizationId },
      select: { id: true, status: true, filters: true },
    });
    if (!b) return { ok: false, error: "Mensagem não encontrada" };
    if (b.status !== "DRAFT" && b.status !== "FAILED" && b.status !== "SCHEDULED")
      return { ok: false, error: "Já enviada." };

    const recipientCount = await db.donor.count({
      where: recipientWhere(organizationId, (b.filters ?? {}) as Record<string, string>),
    });
    if (recipientCount === 0) return { ok: false, error: "Nenhum destinatário para esse filtro." };

    await db.donorBroadcast.update({
      where: { id: b.id },
      data: { status: "SENDING", recipientCount, error: null, scheduledAt: null },
    });
    await enqueueBroadcast(b.id);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/broadcasts`);
  return { ok: true };
}

/** Cancel a pending schedule: SCHEDULED → DRAFT, clearing the fire time. */
export async function unscheduleBroadcast(organizationId: string, broadcastId: string): Promise<CrmResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "ADMIN");
    const b = await db.donorBroadcast.findFirst({
      where: { id: broadcastId, organizationId },
      select: { status: true },
    });
    if (!b) return { ok: false, error: "Mensagem não encontrada" };
    if (b.status !== "SCHEDULED") return { ok: false, error: "Esta mensagem não está agendada." };
    await db.donorBroadcast.update({
      where: { id: broadcastId },
      data: { status: "DRAFT", scheduledAt: null },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/broadcasts`);
  return { ok: true };
}

/** Copy subject/body/filters into a fresh DRAFT and open it. */
export async function duplicateBroadcast(organizationId: string, broadcastId: string): Promise<CrmResult> {
  let copyId: string | null = null;
  try {
    const { db, userId } = await requireOrgAccess(organizationId, "ADMIN");
    const src = await db.donorBroadcast.findFirst({
      where: { id: broadcastId, organizationId },
      select: { name: true, subject: true, bodyText: true, filters: true },
    });
    if (!src) return { ok: false, error: "Mensagem não encontrada" };

    const filters = (src.filters ?? {}) as Record<string, string>;
    const recipientCount = await db.donor.count({ where: recipientWhere(organizationId, filters) });
    const created = await db.donorBroadcast.create({
      data: {
        organizationId,
        name: `Cópia de ${src.name || src.subject}`.slice(0, 80),
        subject: src.subject,
        bodyText: src.bodyText,
        filters,
        recipientCount,
        status: "DRAFT",
        createdByUserId: userId,
      },
      select: { id: true },
    });
    copyId = created.id;
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/broadcasts`);
  if (copyId) redirect(`/orgs/${organizationId}/broadcasts/${copyId}`);
  return { ok: true };
}

export async function deleteBroadcast(organizationId: string, broadcastId: string): Promise<CrmResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "ADMIN");
    const b = await db.donorBroadcast.findFirst({
      where: { id: broadcastId, organizationId },
      select: { status: true },
    });
    if (!b) return { ok: false, error: "Mensagem não encontrada" };
    if (b.status === "SENDING" || b.status === "SENT") return { ok: false, error: "Não é possível excluir uma mensagem enviada." };
    await db.donorBroadcast.deleteMany({ where: { id: broadcastId, organizationId } });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/broadcasts`);
  return { ok: true };
}
