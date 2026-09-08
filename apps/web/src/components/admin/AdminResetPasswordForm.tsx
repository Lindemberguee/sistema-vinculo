"use client";

import { useActionState, useEffect, useRef } from "react";
import { adminResetUserPassword, type AdminUserResult } from "@/server/admin/users";
import { Button, Field, Input } from "@/components/ui";

export function AdminResetPasswordForm({ userId }: { userId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<AdminUserResult | null, FormData>(adminResetUserPassword, null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-2 rounded-lg border border-line bg-canvas p-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Nova senha" error={state?.fieldErrors?.password?.[0]}>
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" className="h-9 text-xs" />
        </Field>
        <Field label="Confirmar" error={state?.fieldErrors?.confirm?.[0]}>
          <Input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="h-9 text-xs" />
        </Field>
      </div>
      {state?.error && <p className="field-error">{state.error}</p>}
      {state?.ok && <p className="text-xs text-success">Senha redefinida e sessões encerradas.</p>}
      <Button type="submit" size="sm" variant="secondary" loading={pending} className="justify-self-start">
        Redefinir senha
      </Button>
    </form>
  );
}
