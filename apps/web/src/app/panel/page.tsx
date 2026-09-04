import Link from "next/link";
import { requireUserPage } from "@/server/auth-helpers";
import { LinkButton, Card, CardBody } from "@/components/ui";
import { VerifyEmailBanner } from "@/components/auth/VerifyEmailBanner";

export default async function PanelHome() {
  const user = await requireUserPage();

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      {!user.verified && <VerifyEmailBanner />}
      <h1 className="text-xl font-semibold">Olá, {user.name}</h1>

      {user.memberships.length === 0 ? (
        <Card className="mt-4">
          <CardBody>
            <p className="text-sm text-muted">Você ainda não faz parte de nenhuma organização.</p>
            <div className="mt-3">
              <LinkButton href="/onboarding">Cadastrar minha organização</LinkButton>
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">Suas organizações</p>
          <ul className="mt-2 grid gap-2">
            {user.memberships.map((m) => (
              <li key={m.organizationId}>
                <Link
                  href={`/orgs/${m.organizationId}`}
                  className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-sm hover:bg-canvas"
                >
                  <span className="font-medium">{m.displayName}</span>
                  <span className="text-xs text-muted">{m.role}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4">
            <Link href="/onboarding" className="link text-sm">
              + Cadastrar outra organização
            </Link>
          </p>
        </>
      )}

      <p className="mt-10 text-sm">
        <Link href="/api/auth/signout" className="link">
          Sair
        </Link>
      </p>
    </main>
  );
}
