"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@donation/db";
import { isAppError } from "@donation/shared";
import { requirePlatformAdmin } from "@/server/admin-helpers";

export interface AdminUserResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8, "Mínimo de 8 caracteres").max(200),
  confirm: z.string().min(8, "Confirme a senha"),
});

export async function adminResetUserPassword(
  _prev: AdminUserResult | null,
  formData: FormData,
): Promise<AdminUserResult> {
  try {
    const admin = await requirePlatformAdmin();
    const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    if (parsed.data.password !== parsed.data.confirm) {
      return { ok: false, fieldErrors: { confirm: ["As senhas não conferem"] } };
    }

    const target = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, email: true },
    });
    if (!target) return { ok: false, error: "Usuário não encontrado." };

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: target.id }, data: { passwordHash } }),
      prisma.session.deleteMany({ where: { userId: target.id } }),
      prisma.auditLog.create({
        data: {
          userId: admin.userId,
          action: "admin.user.password_reset",
          entity: "User",
          entityId: target.id,
          diff: { email: target.email, sessionsRevoked: true },
        },
      }),
    ]);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }

  revalidatePath("/admin/users");
  return { ok: true };
}
