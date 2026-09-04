import { notFound, redirect } from "next/navigation";
import { ForbiddenError, UnauthorizedError } from "@donation/shared";
import { auth } from "@/auth";
import { platformAdminEmails } from "@/env";

/**
 * Platform back-office access. There is no platform-admin table yet; access is
 * an env allowlist (PLATFORM_ADMIN_EMAILS). Swap for a DB flag when it grows.
 */
export async function requirePlatformAdmin() {
  const session = await auth();
  const user = session?.user;
  if (!user?.email) throw new UnauthorizedError();
  const email = user.email.toLowerCase();
  if (!platformAdminEmails.has(email)) throw new ForbiddenError("Acesso restrito ao back-office da plataforma");
  return { email, userId: user.id };
}

export async function requirePlatformAdminPage() {
  const session = await auth();
  const user = session?.user;
  if (!user?.email) {
    redirect("/login");
  }
  const email = user.email.toLowerCase();
  if (!platformAdminEmails.has(email)) notFound();
  return { email, userId: user.id };
}
