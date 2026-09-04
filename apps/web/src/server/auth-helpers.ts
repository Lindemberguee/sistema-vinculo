import { notFound, redirect } from "next/navigation";
import { ForbiddenError, roleAllows, UnauthorizedError, type OrgRole } from "@donation/shared";
import { tenantPrisma } from "@donation/db";
import { auth, type SessionMembership } from "@/auth";

/**
 * Auth guards for panel server components, route handlers and server actions.
 * NEVER trust an `organizationId` coming from the request body — resolve access
 * through the session's memberships here.
 */

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  return session.user;
}

/** Same as requireUser but redirects to /login instead of throwing (for pages). */
export async function requireUserPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

export interface OrgAccess {
  userId: string;
  membership: SessionMembership;
  /** Prisma client already scoped to this org. */
  db: ReturnType<typeof tenantPrisma>;
}

/**
 * Assert the current user has at least `minRole` in `organizationId`.
 * Returns an org-scoped Prisma client so callers can't forget the filter.
 */
export async function requireOrgAccess(organizationId: string, minRole: OrgRole = "VIEWER"): Promise<OrgAccess> {
  const user = await requireUser();
  const membership = user.memberships.find((m) => m.organizationId === organizationId);
  if (!membership) throw new ForbiddenError("You are not a member of this organization");
  if (!roleAllows(membership.role, minRole)) {
    throw new ForbiddenError(`Requires ${minRole} role or higher`);
  }
  return { userId: user.id, membership, db: tenantPrisma(organizationId) };
}

/** Page variant: redirect to /login if signed out, 404 if not a member. */
export async function requireOrgAccessPage(organizationId: string, minRole: OrgRole = "VIEWER") {
  const user = await requireUserPage();
  const membership = user.memberships.find((m) => m.organizationId === organizationId);
  if (!membership || !roleAllows(membership.role, minRole)) notFound();
  return { userId: user.id, membership, db: tenantPrisma(organizationId) };
}

/** Resolve the "active" org for a panel request (query param, else first membership). */
export async function resolveActiveOrg(preferredId?: string) {
  const user = await requireUser();
  if (user.memberships.length === 0) return null;
  const chosen =
    (preferredId && user.memberships.find((m) => m.organizationId === preferredId)) ?? user.memberships[0]!;
  return chosen;
}
