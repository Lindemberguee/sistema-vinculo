import Link from "next/link";
import { prisma } from "@donation/db";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { AcceptInvite } from "@/components/auth/AcceptInvite";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  FINANCE: "Financeiro",
  EDITOR: "Editor",
  VIEWER: "Visualizador",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    select: {
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      organization: { select: { displayName: true } },
    },
  });

  if (!invitation || invitation.acceptedAt || invitation.expiresAt.getTime() <= Date.now()) {
    return (
      <AuthShell title="Convite">
        <p className="mt-3 text-sm text-muted">Este convite não é mais válido. Peça um novo à organização.</p>
        <p className="mt-3 text-sm">
          <Link href="/" className="link">
            Ir para o painel
          </Link>
        </p>
      </AuthShell>
    );
  }

  const session = await auth();
  const orgName = invitation.organization.displayName;
  const roleLabel = ROLE_LABEL[invitation.role] ?? invitation.role;

  if (!session?.user?.id) {
    const next = `/invite/${token}`;
    return (
      <AuthShell title={`Entrar na ${orgName}`}>
        <p className="mt-3 text-sm text-muted">
          Você foi convidado(a) como <strong>{roleLabel}</strong>. Entre com <strong>{invitation.email}</strong> (ou crie
          uma conta com esse e-mail) para aceitar.
        </p>
        <div className="mt-4 grid gap-2">
          <Link href={`/login?callbackUrl=${encodeURIComponent(next)}`} className="btn-primary w-full text-center no-underline">
            Entrar
          </Link>
          <Link
            href={`/register?callbackUrl=${encodeURIComponent(next)}`}
            className="btn-secondary w-full text-center no-underline"
          >
            Criar conta
          </Link>
        </div>
      </AuthShell>
    );
  }

  const emailMatches = session.user.email?.toLowerCase() === invitation.email;

  return (
    <AuthShell title={`Convite para ${orgName}`}>
      {emailMatches ? (
        <>
          <p className="mt-3 text-sm text-muted">
            Você entrará na <strong>{orgName}</strong> como <strong>{roleLabel}</strong>.
          </p>
          <div className="mt-4">
            <AcceptInvite token={token} />
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted">
            Este convite é para <strong>{invitation.email}</strong>, mas você está conectado(a) como{" "}
            <strong>{session.user.email}</strong>.
          </p>
          <p className="mt-3 text-sm">
            <Link href="/api/auth/signout" className="link">
              Sair
            </Link>{" "}
            e entrar com a conta certa.
          </p>
        </>
      )}
    </AuthShell>
  );
}
