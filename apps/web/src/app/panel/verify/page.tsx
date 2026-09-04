import Link from "next/link";
import { consumeEmailVerification } from "@/server/auth/verify";
import { AuthShell } from "@/components/auth/AuthShell";
import { SessionRefresher } from "@/components/auth/SessionRefresher";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await consumeEmailVerification(token) : { status: "invalid" as const };

  return (
    <AuthShell title="Confirmação de e-mail">
      {result.status === "ok" || result.status === "already" ? (
        <>
          <SessionRefresher />
          <p className="mt-3 text-sm text-muted">
            {result.status === "ok" ? "E-mail confirmado! 💚" : "Este e-mail já estava confirmado."}
          </p>
          <p className="mt-3 text-sm">
            <Link href="/" className="link">
              Ir para o painel
            </Link>
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted">Este link é inválido ou expirou.</p>
          <p className="mt-3 text-sm text-muted">
            Entre no painel e use “reenviar confirmação” para receber um novo link.
          </p>
          <p className="mt-3 text-sm">
            <Link href="/login" className="link">
              Entrar
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
