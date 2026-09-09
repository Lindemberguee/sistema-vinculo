"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { requestPasswordReset, type AuthActionResult } from "@/server/auth/actions";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field, Input, Button } from "@/components/ui";

export default function ForgotPage() {
  const [state, action, pending] = useActionState<AuthActionResult | null, FormData>(requestPasswordReset, null);

  return (
    <AuthShell
      title="Esqueci minha senha"
      subtitle={state?.ok ? undefined : "Enviaremos um link para você criar uma nova senha."}
    >
      {state?.ok ? (
        <div className="mt-5">
          <span className="grid size-10 place-items-center rounded-full bg-success-bg text-success">
            <MailCheck className="size-5" aria-hidden />
          </span>
          <p className="mt-3 text-sm text-muted">
            Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha. O link vale
            por 1 hora.
          </p>
        </div>
      ) : (
        <form action={action} className="mt-5 grid gap-3">
          <Field label="E-mail" required error={state?.fieldErrors?.email?.[0]}>
            <Input name="email" type="email" required autoComplete="email" maxLength={160} />
          </Field>
          {state?.error && (
            <p className="field-error" role="alert">
              {state.error}
            </p>
          )}
          <Button type="submit" loading={pending} className="w-full">
            {pending ? "Enviando…" : "Enviar link"}
          </Button>
        </form>
      )}
      <p className="mt-5 text-center text-sm text-muted">
        <Link href="/login" className="link">
          Voltar para entrar
        </Link>
      </p>
    </AuthShell>
  );
}
