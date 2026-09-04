"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@donation/db";
import { resetPasswordEmail, sendEmail, verifyEmailEmail } from "@donation/emails";
import { createHash } from "node:crypto";
import { requireUser } from "@/server/auth-helpers";
import { env } from "@/env";
import { checkActionLimit, checkActionLimitFor, RATE_LIMIT_MESSAGE } from "@/server/rate-limit";
import { expiryFor, identifierFor, isExpired, newToken, parseIdentifier } from "./tokens";

export interface AuthActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Registration echoes the address so the UI can say "we e-mailed X". */
  email?: string;
}

const authUrl = (path: string) => new URL(path, env.NEXTAUTH_URL).toString();

/** Create the verification token (replacing any prior one) and e-mail the link. */
async function sendVerification(userId: string, name: string, email: string) {
  const identifier = identifierFor("verify", email);
  const token = newToken();
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({ data: { identifier, token, expires: expiryFor("verify") } });
  await sendEmail(email, verifyEmailEmail({ name, verifyUrl: authUrl(`/verify?token=${token}`) }));
}

const registerSchema = z
  .object({
    name: z.string().min(2, "Informe seu nome").max(120),
    email: z.string().email("E-mail inválido").max(160),
    password: z.string().min(8, "Mínimo de 8 caracteres").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "As senhas não conferem" });

export async function registerUser(
  _prev: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  if (!(await checkActionLimit("register"))) return { ok: false, error: RATE_LIMIT_MESSAGE };

  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, fieldErrors: { email: ["Já existe uma conta com este e-mail"] } };

  const user = await prisma.user.create({
    data: { name: parsed.data.name.trim(), email, passwordHash: await bcrypt.hash(parsed.data.password, 10) },
    select: { id: true, name: true, email: true },
  });

  try {
    await sendVerification(user.id, user.name, user.email);
  } catch (e) {
    console.error("sendVerification failed:", e);
  }

  return { ok: true, email };
}

/** Re-send the verification e-mail for the signed-in (still unverified) user. */
export async function resendVerification(): Promise<AuthActionResult> {
  const sessionUser = await requireUser();
  if (!(await checkActionLimitFor("resendVerification", sessionUser.id))) {
    return { ok: false, error: "Aguarde alguns minutos antes de pedir outro e-mail." };
  }
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { name: true, email: true, emailVerified: true },
  });
  if (!user) return { ok: false, error: "Usuário não encontrado" };
  if (user.emailVerified) return { ok: true };
  try {
    await sendVerification(sessionUser.id, user.name, user.email);
  } catch (e) {
    console.error("resendVerification failed:", e);
    return { ok: false, error: "Não foi possível enviar agora. Tente de novo em instantes." };
  }
  return { ok: true, email: user.email };
}

const forgotSchema = z.object({ email: z.string().email().max(160) });

/**
 * Always reports success — never reveal whether an address has an account.
 * Only actually e-mails when there's a password-based user.
 */
export async function requestPasswordReset(
  _prev: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = forgotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const email = parsed.data.email.toLowerCase().trim();
  // Rate-limit by IP and by target address (mail-bomb protection). Either way
  // the response is the same "ok" — we just skip the send.
  const emailKey = createHash("sha256").update(email).digest("hex").slice(0, 24);
  const withinLimits =
    (await checkActionLimit("passwordResetIp")) && (await checkActionLimitFor("passwordResetTarget", emailKey));

  const user = withinLimits
    ? await prisma.user.findUnique({ where: { email }, select: { name: true, passwordHash: true } })
    : null;
  if (user?.passwordHash) {
    try {
      const identifier = identifierFor("pwreset", email);
      const token = newToken();
      await prisma.verificationToken.deleteMany({ where: { identifier } });
      await prisma.verificationToken.create({ data: { identifier, token, expires: expiryFor("pwreset") } });
      await sendEmail(email, resetPasswordEmail({ name: user.name, resetUrl: authUrl(`/reset?token=${token}`) }));
    } catch (e) {
      console.error("requestPasswordReset failed:", e);
    }
  }
  return { ok: true };
}

const resetSchema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(8, "Mínimo de 8 caracteres").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "As senhas não conferem" });

export async function resetPassword(
  _prev: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const row = await prisma.verificationToken.findUnique({ where: { token: parsed.data.token } });
  const parsedId = row ? parseIdentifier(row.identifier) : null;
  if (!row || !parsedId || parsedId.kind !== "pwreset" || isExpired(row.expires)) {
    return { ok: false, error: "Este link é inválido ou expirou. Peça um novo." };
  }

  const user = await prisma.user.findUnique({ where: { email: parsedId.email }, select: { id: true } });
  if (!user) return { ok: false, error: "Conta não encontrada." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.verificationToken.deleteMany({ where: { identifier: row.identifier } }),
  ]);

  return { ok: true };
}
