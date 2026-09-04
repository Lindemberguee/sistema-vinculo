"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma, Prisma } from "@donation/db";
import { isAppError } from "@donation/shared";
import { sendEmail, teamInviteEmail } from "@donation/emails";
import { requireOrgAccess, requireUser } from "@/server/auth-helpers";
import { assertUserQuota } from "@/server/billing/limits";
import { checkActionLimit, RATE_LIMIT_MESSAGE } from "@/server/rate-limit";
import { env } from "@/env";

export interface TeamResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  organizationId?: string;
}

const ROLES = ["OWNER", "ADMIN", "FINANCE", "EDITOR", "VIEWER"] as const;
type Role = (typeof ROLES)[number];

const authUrl = (path: string) => new URL(path, env.NEXTAUTH_URL).toString();
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const inviteSchema = z.object({
  email: z.string().email("E-mail inválido").max(160),
  role: z.enum(ROLES),
});

/** Only an OWNER may grant or revoke the OWNER role. */
function assertCanAssign(callerRole: Role, targetRole: Role) {
  if (targetRole === "OWNER" && callerRole !== "OWNER") {
    throw new Error("Apenas um proprietário pode definir outro proprietário.");
  }
}

export async function inviteMember(
  orgId: string,
  _prev: TeamResult | null,
  formData: FormData,
): Promise<TeamResult> {
  try {
    const { db, userId, membership } = await requireOrgAccess(orgId, "ADMIN");
    if (!(await checkActionLimit("inviteSend", orgId))) return { ok: false, error: RATE_LIMIT_MESSAGE };
    const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    assertCanAssign(membership.role as Role, parsed.data.role);

    const email = parsed.data.email.toLowerCase().trim();

    const already = await prisma.membership.findFirst({
      where: { organizationId: orgId, user: { email } },
      select: { id: true },
    });
    if (already) return { ok: false, fieldErrors: { email: ["Esta pessoa já faz parte da equipe"] } };

    await assertUserQuota(db, orgId);

    const inviter = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const org = await db.organization.findFirst({ where: { id: orgId }, select: { displayName: true } });
    if (!org) return { ok: false, error: "Organização não encontrada" };

    const invitation = await prisma.invitation.upsert({
      where: { organizationId_email: { organizationId: orgId, email } },
      create: {
        organizationId: orgId,
        email,
        role: parsed.data.role,
        invitedByUserId: userId,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      update: {
        role: parsed.data.role,
        invitedByUserId: userId,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        acceptedAt: null,
      },
      select: { token: true },
    });

    try {
      await sendEmail(
        email,
        teamInviteEmail({
          orgName: org.displayName,
          inviterName: inviter?.name,
          role: parsed.data.role,
          acceptUrl: authUrl(`/invite/${invitation.token}`),
        }),
      );
    } catch (e) {
      console.error("teamInviteEmail failed:", e);
    }

    revalidatePath(`/panel/orgs/${orgId}/team`);
    return { ok: true, organizationId: orgId };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
}

export async function revokeInvitation(orgId: string, invitationId: string): Promise<TeamResult> {
  try {
    await requireOrgAccess(orgId, "ADMIN");
    const inv = await prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: orgId },
      select: { id: true },
    });
    if (!inv) return { ok: false, error: "Convite não encontrado" };
    await prisma.invitation.delete({ where: { id: inv.id } });
    revalidatePath(`/panel/orgs/${orgId}/team`);
    return { ok: true };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}

export async function resendInvitation(orgId: string, invitationId: string): Promise<TeamResult> {
  try {
    const { db, userId } = await requireOrgAccess(orgId, "ADMIN");
    const inv = await prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: orgId, acceptedAt: null },
      select: { id: true, email: true, role: true },
    });
    if (!inv) return { ok: false, error: "Convite não encontrado" };

    const updated = await prisma.invitation.update({
      where: { id: inv.id },
      data: { expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
      select: { token: true },
    });
    const inviter = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const org = await db.organization.findFirst({ where: { id: orgId }, select: { displayName: true } });

    try {
      await sendEmail(
        inv.email,
        teamInviteEmail({
          orgName: org?.displayName ?? "",
          inviterName: inviter?.name,
          role: inv.role,
          acceptUrl: authUrl(`/invite/${updated.token}`),
        }),
      );
    } catch (e) {
      console.error("resend teamInviteEmail failed:", e);
    }
    revalidatePath(`/panel/orgs/${orgId}/team`);
    return { ok: true };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}

async function ownerCount(orgId: string): Promise<number> {
  return prisma.membership.count({ where: { organizationId: orgId, role: "OWNER" } });
}

export async function changeMemberRole(
  orgId: string,
  membershipId: string,
  role: Role,
): Promise<TeamResult> {
  try {
    const { db, userId, membership: caller } = await requireOrgAccess(orgId, "ADMIN");
    if (!ROLES.includes(role)) return { ok: false, error: "Função inválida" };

    const target = await db.membership.findFirst({
      where: { id: membershipId, organizationId: orgId },
      select: { id: true, userId: true, role: true },
    });
    if (!target) return { ok: false, error: "Integrante não encontrado" };
    if (target.userId === userId) return { ok: false, error: "Você não pode alterar a sua própria função." };

    assertCanAssign(caller.role as Role, role);
    assertCanAssign(caller.role as Role, target.role as Role); // demoting an OWNER also needs OWNER
    if (target.role === "OWNER" && role !== "OWNER" && (await ownerCount(orgId)) <= 1) {
      return { ok: false, error: "A organização precisa de pelo menos um proprietário." };
    }

    await db.membership.update({ where: { id: target.id }, data: { role } });
    revalidatePath(`/panel/orgs/${orgId}/team`);
    return { ok: true };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
}

export async function removeMember(orgId: string, membershipId: string): Promise<TeamResult> {
  try {
    const { db, userId, membership: caller } = await requireOrgAccess(orgId, "ADMIN");
    const target = await db.membership.findFirst({
      where: { id: membershipId, organizationId: orgId },
      select: { id: true, userId: true, role: true },
    });
    if (!target) return { ok: false, error: "Integrante não encontrado" };
    if (target.userId === userId) return { ok: false, error: "Você não pode se remover da equipe." };
    assertCanAssign(caller.role as Role, target.role as Role);
    if (target.role === "OWNER" && (await ownerCount(orgId)) <= 1) {
      return { ok: false, error: "A organização precisa de pelo menos um proprietário." };
    }
    await db.membership.delete({ where: { id: target.id } });
    revalidatePath(`/panel/orgs/${orgId}/team`);
    return { ok: true };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
}

/** Accept an invitation as the signed-in user (email must match). */
export async function acceptInvitation(token: string): Promise<TeamResult> {
  try {
    if (!(await checkActionLimit("inviteAccept"))) return { ok: false, error: RATE_LIMIT_MESSAGE };
    const user = await requireUser();
    const inv = await prisma.invitation.findUnique({
      where: { token },
      select: { id: true, organizationId: true, email: true, role: true, expiresAt: true, acceptedAt: true },
    });
    if (!inv || inv.acceptedAt) return { ok: false, error: "Este convite não é mais válido." };
    if (inv.expiresAt.getTime() <= Date.now()) return { ok: false, error: "Este convite expirou." };
    if (inv.email !== user.email?.toLowerCase()) {
      return { ok: false, error: "Este convite é para outro e-mail. Entre com a conta convidada." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.membership.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: inv.organizationId } },
        create: { userId: user.id, organizationId: inv.organizationId, role: inv.role },
        update: { role: inv.role },
      });
      await tx.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          organizationId: inv.organizationId,
          userId: user.id,
          action: "team.joined",
          entity: "Membership",
          entityId: user.id,
          diff: { role: inv.role } as Prisma.InputJsonValue,
        },
      });
    });

    revalidatePath(`/panel/orgs/${inv.organizationId}/team`);
    return { ok: true, organizationId: inv.organizationId };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
}
