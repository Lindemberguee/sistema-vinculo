import Link from "next/link";
import { prisma } from "@donation/db";
import { requirePlatformAdminPage } from "@/server/admin-helpers";
import { AdminResetPasswordForm } from "@/components/admin/AdminResetPasswordForm";
import { appPanelOrigin } from "@/server/links/url";
import { PageHeader, Card, CardBody, Table, Th, Td, Tr, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default async function AdminUsersPage() {
  await requirePlatformAdminPage();
  const appOrigin = appPanelOrigin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      passwordHash: true,
      createdAt: true,
      updatedAt: true,
      memberships: {
        select: {
          role: true,
          organization: { select: { id: true, displayName: true, slug: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      accounts: { select: { provider: true } },
      sessions: { select: { expires: true }, orderBy: { expires: "desc" }, take: 1 },
    },
  });

  const withPassword = users.filter((u) => Boolean(u.passwordHash)).length;
  const googleUsers = users.filter((u) => u.accounts.some((a) => a.provider === "google")).length;
  const verified = users.filter((u) => Boolean(u.emailVerified)).length;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <PageHeader
        title="Usuários"
        description="Contas, acessos, vínculos com organizações e reset manual de senha."
        actions={<Link href="/admin" className="btn-secondary btn-sm no-underline">← Visão geral</Link>}
      />

      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <Kpi label="Usuários" value={users.length.toString()} detail="contas cadastradas" />
        <Kpi label="E-mail verificado" value={`${verified}/${users.length}`} detail="aptos para comunicações" />
        <Kpi label="Senha local" value={withPassword.toString()} detail="login por credenciais" />
        <Kpi label="Google" value={googleUsers.toString()} detail="contas OAuth vinculadas" />
      </section>

      <Card className="overflow-hidden">
        <CardBody className="p-0">
          <Table>
            <thead>
              <Tr>
                <Th>Usuário</Th>
                <Th>Acesso</Th>
                <Th>Organizações</Th>
                <Th>Atividade</Th>
                <Th className="min-w-80">Reset manual</Th>
              </Tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <Tr key={u.id}>
                  <Td>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted">{u.email}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {u.emailVerified ? <Badge tone="success">verificado</Badge> : <Badge tone="warn">não verificado</Badge>}
                      {u.passwordHash ? <Badge>senha</Badge> : null}
                      {u.accounts.map((a) => <Badge key={a.provider} tone="info">{a.provider}</Badge>)}
                    </div>
                  </Td>
                  <Td className="text-sm">
                    <div>{u.passwordHash ? "Credenciais" : "OAuth"}</div>
                    <div className="text-xs text-muted">{u.sessions[0] ? `sessão até ${dt.format(u.sessions[0].expires)}` : "sem sessão ativa"}</div>
                  </Td>
                  <Td>
                    <div className="grid gap-1">
                      {u.memberships.length ? u.memberships.map((m) => (
                        <div key={`${u.id}-${m.organization.id}`} className="text-sm">
                          <Link href={`${appOrigin}/orgs/${m.organization.id}`} className="link">{m.organization.displayName}</Link>
                          <span className="text-muted"> · {m.role} · {m.organization.status}</span>
                        </div>
                      )) : <span className="text-sm text-muted">Sem organização</span>}
                    </div>
                  </Td>
                  <Td className="text-xs text-muted">
                    <div>Criado: {dt.format(u.createdAt)}</div>
                    <div>Atualizado: {dt.format(u.updatedAt)}</div>
                  </Td>
                  <Td>
                    <AdminResetPasswordForm userId={u.id} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </main>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="card p-5"><p className="eyebrow">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted">{detail}</p></div>;
}
