"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import {
  EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_KINDS,
  normalizeEmailBlocks,
  renderEmailBlocks,
  renderTemplate,
  sendEmail,
  type EmailTemplateKind,
} from "@donation/emails";
import { resolveOrgSender } from "@donation/db";
import { requireOrgAccess } from "@/server/auth-helpers";
import { checkActionLimitFor } from "@/server/rate-limit";
import type { OrgResult } from "@/server/org/email-config";
import { TEMPLATE_SAMPLE } from "./email-templates-queries";

function assertKind(raw: unknown): EmailTemplateKind {
  if (typeof raw === "string" && (EMAIL_TEMPLATE_KINDS as string[]).includes(raw)) return raw as EmailTemplateKind;
  throw new Error("Template inválido");
}

const subjectSchema = z.string().trim().min(3, "Assunto muito curto").max(150);

export async function updateEmailTemplate(
  organizationId: string,
  kindRaw: string,
  _prev: OrgResult | null,
  formData: FormData,
): Promise<OrgResult> {
  try {
    const { db, userId } = await requireOrgAccess(organizationId, "ADMIN");
    const kind = assertKind(kindRaw);

    const subjectParsed = subjectSchema.safeParse(formData.get("subject"));
    if (!subjectParsed.success)
      return { ok: false, error: subjectParsed.error.issues[0]?.message ?? "Assunto inválido" };

    let rawBlocks: unknown;
    try {
      rawBlocks = JSON.parse(String(formData.get("blocksJson") ?? "[]"));
    } catch {
      return { ok: false, error: "Não foi possível ler os blocos." };
    }
    const blocks = normalizeEmailBlocks(rawBlocks);
    if (blocks.length === 0) return { ok: false, error: "Adicione ao menos um bloco." };

    const bodyHtml = renderEmailBlocks(blocks);
    const data = {
      subject: subjectParsed.data,
      bodyHtml,
      blocksJson: blocks as unknown as object,
      updatedByUserId: userId,
    };

    await db.emailTemplate.upsert({
      where: { organizationId_kind_locale: { organizationId, kind, locale: "pt-BR" } },
      create: { organizationId, kind, locale: "pt-BR", ...data },
      update: data,
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/broadcasts/templates`);
  return { ok: true };
}

/** Discard the org override → back to the platform default. */
export async function resetEmailTemplate(organizationId: string, kindRaw: string): Promise<OrgResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "ADMIN");
    const kind = assertKind(kindRaw);
    await db.emailTemplate.deleteMany({ where: { organizationId, kind, locale: "pt-BR" } });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/broadcasts/templates`);
  return { ok: true };
}

/** Turn an opt-in relationship recipe on/off. Creates the row (with defaults) on first toggle. */
export async function toggleEmailTemplate(organizationId: string, kindRaw: string): Promise<OrgResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "ADMIN");
    const kind = assertKind(kindRaw);
    if (!EMAIL_TEMPLATES[kind].optIn) return { ok: false, error: "Este e-mail não pode ser desligado." };

    const existing = await db.emailTemplate.findUnique({
      where: { organizationId_kind_locale: { organizationId, kind, locale: "pt-BR" } },
      select: { enabled: true },
    });
    const def = EMAIL_TEMPLATES[kind];
    await db.emailTemplate.upsert({
      where: { organizationId_kind_locale: { organizationId, kind, locale: "pt-BR" } },
      create: {
        organizationId,
        kind,
        locale: "pt-BR",
        subject: def.subjectDefault,
        bodyHtml: def.bodyHtmlDefault,
        blocksJson: def.blocksDefault as unknown as object,
        enabled: true,
      },
      update: { enabled: !existing?.enabled },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/broadcasts/templates`);
  return { ok: true };
}

const testSchema = z.object({
  to: z.string().trim().toLowerCase().email("E-mail inválido").max(200),
  subject: z.string().trim().min(1).max(150),
});

/** Render the (possibly unsaved) template with sample data + org sender, send it to `to`. */
export async function sendEmailTemplateTest(
  organizationId: string,
  kindRaw: string,
  _prev: OrgResult | null,
  formData: FormData,
): Promise<OrgResult> {
  try {
    const { db, userId } = await requireOrgAccess(organizationId, "ADMIN");
    if (!(await checkActionLimitFor("emailTest", userId))) {
      return { ok: false, error: "Muitos testes seguidos. Aguarde alguns minutos." };
    }
    if (!process.env.RESEND_API_KEY) {
      return { ok: false, error: "Envio de e-mail ainda não está configurado nesta instância." };
    }

    const kind = assertKind(kindRaw);
    const parsed = testSchema.safeParse({ to: formData.get("to"), subject: formData.get("subject") });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

    let rawBlocks: unknown;
    try {
      rawBlocks = JSON.parse(String(formData.get("blocksJson") ?? "[]"));
    } catch {
      return { ok: false, error: "Não foi possível ler os blocos." };
    }
    const blocks = normalizeEmailBlocks(rawBlocks);
    if (blocks.length === 0) return { ok: false, error: "Adicione ao menos um bloco antes de testar." };

    const [org, sender] = await Promise.all([
      db.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { displayName: true, emailConfig: { select: { logoUrl: true } } },
      }),
      resolveOrgSender(organizationId),
    ]);

    const rendered = renderTemplate({
      subject: `[Teste] ${parsed.data.subject}`,
      bodyHtml: renderEmailBlocks(blocks),
      vars: TEMPLATE_SAMPLE,
      logoUrl: org.emailConfig?.logoUrl ?? null,
      orgName: org.displayName,
    });

    await sendEmail(parsed.data.to, rendered, { from: sender.from, replyTo: sender.replyTo });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
  return { ok: true };
}

const logoSchema = z.string().trim().url("URL inválida").max(500).optional().or(z.literal(""));

export async function updateEmailLogo(
  organizationId: string,
  _prev: OrgResult | null,
  formData: FormData,
): Promise<OrgResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "ADMIN");
    const parsed = logoSchema.safeParse(formData.get("logoUrl"));
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "URL inválida" };
    const logoUrl = parsed.data || null;
    await db.organizationEmailConfig.upsert({
      where: { organizationId },
      create: { organizationId, logoUrl },
      update: { logoUrl },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/broadcasts/templates`);
  return { ok: true };
}
