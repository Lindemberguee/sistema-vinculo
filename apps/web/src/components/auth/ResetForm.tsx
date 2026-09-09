"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { resetPassword, type AuthActionResult } from "@/server/auth/actions";
import { Field, PasswordInput, Button } from "@/components/ui";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthActionResult | null, FormData>(resetPassword, null);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  if (state?.ok) {
    return (
      <div className="mt-5">
        <span className="grid size-10 place-items-center rounded-full bg-success-bg text-success">
          <Check className="size-5" aria-hidden />
        </span>
        <p className="mt-3 text-sm">
          Senha redefinida.{" "}
          <Link href="/login" className="link">
            Entrar
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-5 grid gap-3">
      <input type="hidden" name="token" value={token} />
      <Field label="Nova senha" required error={err("password")} hint="Mínimo de 8 caracteres.">
        <PasswordInput name="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Field label="Confirmar senha" required error={err("confirm")}>
        <PasswordInput name="confirm" required minLength={8} autoComplete="new-password" />
      </Field>
      {state?.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" loading={pending} className="w-full">
        {pending ? "Salvando…" : "Salvar nova senha"}
      </Button>
    </form>
  );
}
