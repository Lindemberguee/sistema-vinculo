"use client";

import { useActionState, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { updateOwnName, changeOwnPassword, type AccountResult } from "@/server/account/actions";
import { Button, Field, Input, PasswordInput } from "@/components/ui";

function Saved({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span role="status" className="text-xs text-success">
      Salvo
    </span>
  );
}

export function ProfileNameForm({ initialName }: { initialName: string }) {
  const { update } = useSession();
  const [state, action, pending] = useActionState<AccountResult | null, FormData>(updateOwnName, null);
  const [name, setName] = useState(initialName);

  // Re-sync the session (JWT) so the sidebar / greeting pick up the new name.
  useEffect(() => {
    if (state?.ok) void update();
  }, [state?.ok, update]);

  return (
    <form action={action} className="grid gap-3">
      <Field label="Nome" required error={state?.fieldErrors?.name?.[0]}>
        <Input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={120}
          required
        />
      </Field>
      {state?.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} disabled={name.trim() === initialName.trim() || name.trim().length < 2}>
          Salvar
        </Button>
        <Saved show={Boolean(state?.ok)} />
      </div>
    </form>
  );
}

export function ProfilePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState<AccountResult | null, FormData>(changeOwnPassword, null);
  const [key, setKey] = useState(0);

  // Clear the fields after a successful change.
  useEffect(() => {
    if (state?.ok) setKey((k) => k + 1);
  }, [state?.ok]);

  return (
    <form key={key} action={action} className="grid gap-3">
      {hasPassword && (
        <Field label="Senha atual" required error={state?.fieldErrors?.currentPassword?.[0]}>
          <PasswordInput name="currentPassword" autoComplete="current-password" required />
        </Field>
      )}
      <Field
        label={hasPassword ? "Nova senha" : "Senha"}
        required
        error={state?.fieldErrors?.password?.[0]}
        hint="Mínimo de 8 caracteres."
      >
        <PasswordInput name="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirmar senha" required error={state?.fieldErrors?.confirm?.[0]}>
        <PasswordInput name="confirm" autoComplete="new-password" minLength={8} required />
      </Field>
      {state?.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {hasPassword ? "Alterar senha" : "Definir senha"}
        </Button>
        <Saved show={Boolean(state?.ok)} />
      </div>
    </form>
  );
}
