"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPassword, type AuthActionResult } from "@/server/auth/actions";
import { Field, Input, Button } from "@/components/ui";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthActionResult | null, FormData>(resetPassword, null);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  if (state?.ok) {
    return (
      <p className="mt-3 text-sm">
        Senha redefinida.{" "}
        <Link href="/login" className="link">
          Entrar
        </Link>
      </p>
    );
  }

  return (
    <form action={action} className="mt-4 grid gap-3">
      <input type="hidden" name="token" value={token} />
      <Field label="Nova senha" error={err("password")} hint="Mínimo de 8 caracteres.">
        <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Field label="Confirmar senha" error={err("confirm")}>
        <Input name="confirm" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      {state?.error && <p className="field-error">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Salvando…" : "Salvar nova senha"}
      </Button>
    </form>
  );
}
