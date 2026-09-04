"use client";

import { useActionState } from "react";
import { updateAmbassador, type ActionResult } from "@/server/ambassadors/actions";
import { Field, Input, Textarea, Button } from "@/components/ui";

export interface AmbassadorManageValues {
  headline: string;
  message: string;
  goalReais: string;
  photoUrl: string;
}

export function AmbassadorManageForm({ token, initial }: { token: string; initial: AmbassadorManageValues }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateAmbassador.bind(null, token),
    null,
  );
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold">Editar minha página</h2>

      <Field label="Frase de chamada" error={err("headline")}>
        <Input name="headline" defaultValue={initial.headline} maxLength={120} />
      </Field>
      <Field label="Sua mensagem" error={err("message")}>
        <Textarea name="message" defaultValue={initial.message} rows={5} maxLength={2000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sua meta (R$)" error={err("goalReais")}>
          <Input name="goalReais" defaultValue={initial.goalReais} inputMode="decimal" placeholder="1.000,00" />
        </Field>
        <Field label="Foto (URL)" error={err("photoUrl")}>
          <Input name="photoUrl" type="url" defaultValue={initial.photoUrl} placeholder="https://…/foto.jpg" />
        </Field>
      </div>

      {state?.error && <p className="field-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        {state?.ok && <span className="text-sm text-success">Salvo.</span>}
      </div>
    </form>
  );
}
