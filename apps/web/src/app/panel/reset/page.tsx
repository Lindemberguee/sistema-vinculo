import Link from "next/link";
import { resetTokenIsValid } from "@/server/auth/verify";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/ResetForm";

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = token ? await resetTokenIsValid(token) : false;

  return (
    <AuthShell title="Criar nova senha">
      {valid && token ? (
        <ResetForm token={token} />
      ) : (
        <>
          <p className="mt-3 text-sm text-muted">Este link é inválido ou expirou.</p>
          <p className="mt-3 text-sm">
            <Link href="/forgot" className="link">
              Pedir um novo link
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
