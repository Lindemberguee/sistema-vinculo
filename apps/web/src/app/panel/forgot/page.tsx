"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type AuthActionResult } from "@/server/auth/actions";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field, Input, Button } from "@/components/ui";

export default function ForgotPage() {
  const [state, action, pending] = useActionState<AuthActionResult | null, FormData>(requestPasswordReset, null);

  return (
    <AuthShell title="Esqueci minha senha">
      {state?.ok ? (
        <p className="mt-3 text-sm text-muted">
          Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha. O link vale por 1 hora.
        </p>
      ) : (
        <form action={action} className="mt-4 grid gap-3">
          <p className="text-sm text-muted">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
          <Field label="E-mail" error={state?.fieldErrors?.email?.[0]}>
            <Input name="email" type="email" required autoComplete="email" maxLength={160} />
          </Field>
          {state?.error && <p className="field-error">{state.error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Enviando…" : "Enviar link"}
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-muted">
        <Link href="/login" className="link">
          Voltar para entrar
        </Link>
      </p>
    </AuthShell>
  );
}
