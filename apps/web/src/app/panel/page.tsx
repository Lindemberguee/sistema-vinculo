import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserPage } from "@/server/auth-helpers";
import { VerifyEmailBanner } from "@/components/auth/VerifyEmailBanner";

export default async function PanelHome() {
  const user = await requireUserPage();

  // First access with no organization yet: send straight to onboarding — that
  // is the only next step, so don't make the user click through a card.
  if (user.memberships.length === 0) redirect("/onboarding");

  // A single organization: skip the picker and go straight in.
  if (user.memberships.length === 1) redirect(`/orgs/${user.memberships[0]!.organizationId}`);

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      {!user.verified && <VerifyEmailBanner />}
      <h1 className="text-xl font-semibold">Olá, {user.name}</h1>

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

      <p className="mt-10 text-sm">
        <Link href="/api/auth/signout" className="link">
          Sair
        </Link>
      </p>
    </main>
  );
}
