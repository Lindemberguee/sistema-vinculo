import Link from "next/link";
import { prisma } from "@donation/db";
import { requireUserPage } from "@/server/auth-helpers";
import { VerifyEmailBanner } from "@/components/auth/VerifyEmailBanner";
import { ProfileNameForm, ProfilePasswordForm } from "@/components/account/AccountClient";
import { PageHeader, FormSection, Badge } from "@/components/ui";

export const metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const sessionUser = await requireUserPage();
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      name: true,
      email: true,
      emailVerified: true,
      passwordHash: true,
      createdAt: true,
      accounts: { select: { provider: true } },
    },
  });
  if (!user) return null;

  const dtf = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PageHeader
        title="Minha conta"
        description="Seus dados de acesso. As permissões em cada organização são geridas pela equipe dela."
        back={{ href: "/", label: "Painel" }}
      />

      {!sessionUser.verified && <VerifyEmailBanner />}

      <div className="grid gap-6 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <FormSection title="Nome" description="Como você aparece para a equipe das organizações.">
          <ProfileNameForm initialName={user.name} />
        </FormSection>

        <FormSection title="E-mail" description="Usado para entrar e receber avisos.">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-ink">{user.email}</span>
            {user.emailVerified ? (
              <Badge tone="success">verificado</Badge>
            ) : (
              <Badge tone="warn">não verificado</Badge>
            )}
          </div>
          <p className="text-xs text-muted">
            Para trocar o e-mail de acesso, fale com o suporte.
          </p>
        </FormSection>

        <FormSection
          title={user.passwordHash ? "Senha" : "Definir uma senha"}
          description={
            user.passwordHash
              ? "Use uma senha longa e exclusiva."
              : "Sua conta entra por provedor externo. Defina uma senha para também poder entrar por e-mail."
          }
        >
          <ProfilePasswordForm hasPassword={Boolean(user.passwordHash)} />
        </FormSection>

        <FormSection title="Acesso" description="Provedores e organizações vinculados a esta conta.">
          <dl className="grid gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-muted">Entrar com</dt>
              <dd className="flex flex-wrap gap-1">
                {user.passwordHash && <Badge>e-mail e senha</Badge>}
                {user.accounts.map((a) => (
                  <Badge key={a.provider} tone="info">
                    {a.provider}
                  </Badge>
                ))}
                {!user.passwordHash && user.accounts.length === 0 && (
                  <span className="text-muted">—</span>
                )}
              </dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-muted">Organizações</dt>
              <dd className="flex flex-wrap gap-x-3 gap-y-1">
                {sessionUser.memberships.length === 0 ? (
                  <span className="text-muted">Nenhuma</span>
                ) : (
                  sessionUser.memberships.map((m) => (
                    <Link key={m.organizationId} href={`/orgs/${m.organizationId}`} className="link">
                      {m.displayName} <span className="text-muted">· {m.role}</span>
                    </Link>
                  ))
                )}
              </dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-muted">Conta criada em</dt>
              <dd>{dtf.format(user.createdAt)}</dd>
            </div>
          </dl>
        </FormSection>
      </div>

      <p className="mt-6 text-sm">
        <Link href="/api/auth/signout" prefetch={false} className="link">
          Sair da conta
        </Link>
      </p>
    </main>
  );
}
