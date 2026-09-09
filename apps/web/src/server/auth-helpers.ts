import { notFound, redirect } from "next/navigation";
import { ForbiddenError, roleAllows, UnauthorizedError, type OrgRole } from "@donation/shared";
import { prisma, tenantPrisma, withDbRetry } from "@donation/db";
import { auth, type SessionMembership } from "@/auth";

/**
 * Auth guards for panel server components, route handlers and server actions.
 * NEVER trust an `organizationId` coming from the request body — resolve access
 * through the session's memberships here.
 */

/**
 * The session's memberships come from a JWT that only refreshes on sign-in or an
 * explicit `update()` — so a removed member or a demoted role would stay valid
 * for the life of the token (NextAuth default: 30 days). Re-read the membership
 * from the DB on every org-scoped guard so `removeMember` / `changeMemberRole`
 * take effect on the victim's very next request. Also lets a freshly-invited
 * user in without waiting for their token to refresh.
 *
 * This now sits in the render path of every panel page, so it must survive a
 * Neon pooled-connection recycle (P1017 & co.) — hence `withDbRetry`. Without
 * it, one dropped connection here 500s an otherwise fine page.
 */
async function currentMembership(userId: string, organizationId: string): Promise<SessionMembership | null> {
  const row = await withDbRetry(() =>
    prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { role: true, organization: { select: { id: true, slug: true, displayName: true } } },
    }),
  );
  if (!row) return null;
  return {
    organizationId: row.organization.id,
    slug: row.organization.slug,
    displayName: row.organization.displayName,
    role: row.role as OrgRole,
  };
}

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
  const membership = await currentMembership(user.id, organizationId);
  if (!membership) throw new ForbiddenError("You are not a member of this organization");
  if (!roleAllows(membership.role, minRole)) {
    throw new ForbiddenError(`Requires ${minRole} role or higher`);
  }
  return { userId: user.id, membership, db: tenantPrisma(organizationId) };
}

/** Page variant: redirect to /login if signed out, 404 if not a member. */
export async function requireOrgAccessPage(organizationId: string, minRole: OrgRole = "VIEWER") {
  const user = await requireUserPage();
  const membership = await currentMembership(user.id, organizationId);
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
