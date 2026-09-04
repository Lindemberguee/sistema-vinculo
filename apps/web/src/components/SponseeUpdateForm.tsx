"use client";

import { useActionState, useEffect, useRef } from "react";
import { publishUpdateFormAction, type SponseeResult } from "@/server/sponsees/actions";
import { Field, Input, Textarea, Button } from "@/components/ui";

export function SponseeUpdateForm({ orgId, sponseeId }: { orgId: string; sponseeId: string }) {
  const action = publishUpdateFormAction.bind(null, orgId, sponseeId);
  const [state, formAction, pending] = useActionState<SponseeResult | null, FormData>(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-3">
      <Field label="Título" error={err("title")}>
        <Input name="title" required />
      </Field>
      <Field label="Mensagem" error={err("body")}>
        <Textarea name="body" rows={4} required />
      </Field>
      <Field label="Foto (URL, opcional)" error={err("photoUrl")}>
        <Input name="photoUrl" type="url" />
      </Field>
      {state?.error && <p className="field-error">{state.error}</p>}
      {state?.ok && <p className="text-sm text-success">Atualização publicada e enviada ao padrinho.</p>}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Publicando…" : "Publicar atualização"}
        </Button>
      </div>
    </form>
  );
}
