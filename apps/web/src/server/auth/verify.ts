import { prisma } from "@donation/db";
import { isExpired, parseIdentifier } from "./tokens";

/**
 * Consume an e-mail verification token. Called from the `/verify` page (a server
 * component). Idempotent-ish: a token is single-use, but re-verifying an already
 * verified address is reported as "already".
 */
export async function consumeEmailVerification(
  token: string,
): Promise<{ status: "ok" | "already" | "invalid" }> {
  if (!token || token.length < 10) return { status: "invalid" };

  const row = await prisma.verificationToken.findUnique({ where: { token } });
  const id = row ? parseIdentifier(row.identifier) : null;
  if (!row || !id || id.kind !== "verify" || isExpired(row.expires)) {
    // Maybe the address is already verified (token consumed on an earlier click).
    return { status: "invalid" };
  }

  const user = await prisma.user.findUnique({ where: { email: id.email }, select: { id: true, emailVerified: true } });
  if (!user) return { status: "invalid" };

  if (!user.emailVerified) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  }
  await prisma.verificationToken.deleteMany({ where: { identifier: row.identifier } });
  return { status: user.emailVerified ? "already" : "ok" };
}

/** Whether a reset token is currently usable — for the `/reset` page to gate the form. */
export async function resetTokenIsValid(token: string): Promise<boolean> {
  if (!token || token.length < 10) return false;
  const row = await prisma.verificationToken.findUnique({ where: { token } });
  const id = row ? parseIdentifier(row.identifier) : null;
  return Boolean(row && id && id.kind === "pwreset" && !isExpired(row.expires));
}
