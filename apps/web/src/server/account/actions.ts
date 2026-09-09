"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@donation/db";
import { requireUser } from "@/server/auth-helpers";
import { checkActionLimitFor, RATE_LIMIT_MESSAGE } from "@/server/rate-limit";

export interface AccountResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

const nameSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(120),
});

/** Update the signed-in user's display name. */
export async function updateOwnName(
  _prev: AccountResult | null,
  formData: FormData,
): Promise<AccountResult> {
  const user = await requireUser();
  const parsed = nameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
  return { ok: true };
}

const passwordSchema = z
  .object({
    currentPassword: z.string().optional().or(z.literal("")),
    password: z.string().min(8, "Mínimo de 8 caracteres").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "As senhas não conferem" });

/**
 * Change (or, for an OAuth-only account, set) the signed-in user's password.
 * When the account already has a password the current one must be provided.
 *
 * Note: existing sessions are NOT invalidated here — the app uses stateless
 * JWT sessions with no server-side revocation (tracked separately).
 */
export async function changeOwnPassword(
  _prev: AccountResult | null,
  formData: FormData,
): Promise<AccountResult> {
  const sessionUser = await requireUser();
  if (!(await checkActionLimitFor("changePassword", sessionUser.id))) {
    return { ok: false, error: RATE_LIMIT_MESSAGE };
  }

  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { passwordHash: true },
  });
  if (!user) return { ok: false, error: "Usuário não encontrado" };

  if (user.passwordHash) {
    const current = parsed.data.currentPassword ?? "";
    const ok = current.length > 0 && (await bcrypt.compare(current, user.passwordHash));
    if (!ok) return { ok: false, fieldErrors: { currentPassword: ["Senha atual incorreta"] } };
  }

  await prisma.user.update({
    where: { id: sessionUser.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 10) },
  });
  return { ok: true };
}
