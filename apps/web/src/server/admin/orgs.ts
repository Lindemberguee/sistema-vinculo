"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma, Prisma } from "@donation/db";
import { addInterval, isAppError, TRIAL_PERIOD_DAYS } from "@donation/shared";
import { sendEmail, teamInviteEmail } from "@donation/emails";
import { requirePlatformAdmin } from "@/server/admin-helpers";
import { env } from "@/env";

export interface AdminOrgCreateResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  organizationId?: string;
}

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const digits = (s: string) => s.replace(/\D/g, "");
const authUrl = (path: string) => new URL(path, env.NEXTAUTH_URL).toString();
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const schema = z.object({
  legalName: z.string().min(3, "Informe a razão social").max(160),
  displayName: z.string().min(2, "Informe o nome público").max(80),
  cnpj: z.string().transform(digits).pipe(z.string().length(14, "CNPJ deve ter 14 dígitos")),
  slug: z.string().min(2).max(63).regex(slugRe, "Use apenas letras minúsculas, números e hífens"),
  planId: z.string().min(1, "Escolha um plano"),
  ownerEmail: z.string().email("E-mail do responsável inválido").max(160),
  /** trial = 30 dias grátis; active = já marcada como paga. */
  billing: z.enum(["trial", "active"]).default("trial"),
});

/**
 * Concierge onboarding: the platform admin creates an organization on behalf of
 * an institution. The org is created ACTIVE (the platform vouches — no KYC gate),
 * with a subscription and an OWNER invitation e-mailed to the responsible person,
 * who accepts it to get in (registering if they don't have an account yet).
 */
export async function adminCreateOrganization(
  _prev: AdminOrgCreateResult | null,
  formData: FormData,
): Promise<AdminOrgCreateResult> {
  try {
    const { userId } = await requirePlatformAdmin();
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    const d = parsed.data;

    const plan = await prisma.plan.findUnique({ where: { id: d.planId }, select: { id: true } });
    if (!plan) return { ok: false, fieldErrors: { planId: ["Plano inválido"] } };

    const ownerEmail = d.ownerEmail.toLowerCase().trim();
    const now = new Date();

    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          slug: d.slug,
          legalName: d.legalName,
          displayName: d.displayName,
          cnpj: d.cnpj,
          planId: d.planId,
          status: "ACTIVE",
          kycStatus: "APPROVED",
        },
        select: { id: true, displayName: true },
      });

      await tx.subscription.create({
        data: {
          organizationId: created.id,
          planId: d.planId,
          ...(d.billing === "active"
            ? { status: "ACTIVE", lastPaidAt: now, currentPeriodEnd: addInterval(now, "MONTHLY") }
            : { status: "TRIALING", currentPeriodEnd: new Date(now.getTime() + TRIAL_PERIOD_DAYS * 86_400_000) }),
        },
      });

      const invitation = await tx.invitation.create({
        data: {
          organizationId: created.id,
          email: ownerEmail,
          role: "OWNER",
          invitedByUserId: userId,
          expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
        },
        select: { token: true },
      });

      await tx.auditLog.create({
        data: {
          organizationId: created.id,
          userId,
          action: "org.created",
          entity: "Organization",
          entityId: created.id,
          diff: { by: "admin", plan: d.planId, billing: d.billing, ownerEmail } as Prisma.InputJsonValue,
        },
      });

      return { ...created, inviteToken: invitation.token };
    });

    try {
      await sendEmail(
        ownerEmail,
        teamInviteEmail({
          orgName: org.displayName,
          role: "OWNER",
          acceptUrl: authUrl(`/invite/${org.inviteToken}`),
        }),
      );
    } catch (e) {
      console.error("adminCreateOrganization invite email failed:", e);
    }

    revalidatePath("/admin/orgs");
    return { ok: true, organizationId: org.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = String((err.meta as { target?: string[] } | undefined)?.target ?? "");
      if (target.includes("slug")) return { ok: false, fieldErrors: { slug: ["Endereço já em uso"] } };
      if (target.includes("cnpj")) return { ok: false, fieldErrors: { cnpj: ["Já existe uma organização com este CNPJ"] } };
    }
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}
