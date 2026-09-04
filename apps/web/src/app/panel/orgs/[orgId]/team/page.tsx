import { requireOrgAccessPage } from "@/server/auth-helpers";
import { PageHeader } from "@/components/ui";
import { TeamManager } from "@/components/team/TeamManager";

export default async function TeamPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db, userId, membership } = await requireOrgAccessPage(orgId, "ADMIN");

  const [members, invites] = await Promise.all([
    db.membership.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, userId: true, user: { select: { name: true, email: true } } },
    }),
    db.invitation.findMany({
      where: { organizationId: orgId, acceptedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, expiresAt: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Equipe"
        description="Convide pessoas e defina o que cada uma pode fazer nesta organização."
        back={{ href: `/orgs/${orgId}`, label: "Painel" }}
      />
      <TeamManager
        orgId={orgId}
        callerUserId={userId}
        callerRole={membership.role}
        members={members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          name: m.user.name,
          email: m.user.email,
        }))}
        invites={invites.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          expiresAt: i.expiresAt.toLocaleDateString("pt-BR"),
        }))}
      />
    </>
  );
}
