"use client";

import { useActionState, useState } from "react";
import { createAmbassador, type AmbassadorCreateResult } from "@/server/ambassadors/actions";
import { Field, Input, Textarea, Button } from "@/components/ui";

export function AmbassadorJoinForm({
  orgId,
  campaignId,
  campaignTitle,
  publicOrigin,
}: {
  orgId: string;
  campaignId: string;
  campaignTitle: string;
  publicOrigin: string;
}) {
  const [state, action, pending] = useActionState<AmbassadorCreateResult | null, FormData>(
    createAmbassador.bind(null, orgId, campaignId),
    null,
  );
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  if (state?.ok && state.slug) {
    const publicUrl = `${publicOrigin}/embaixador/${state.slug}`;
    const manageUrl = state.manageToken ? `${publicOrigin}/embaixador/gerir/${state.manageToken}` : null;
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-lg font-semibold">Pronto! Sua página está no ar 💚</h2>
        {state.error && <p className="mt-1 text-sm text-muted">{state.error}</p>}
        <p className="mt-3 text-sm">Compartilhe este link — cada doação por ele conta para você e para a campanha:</p>
        <CopyRow value={publicUrl} />
        {manageUrl && (
          <>
            <p className="mt-4 text-sm">Para editar seu texto, foto e meta depois, guarde este link privado:</p>
            <CopyRow value={manageUrl} muted />
          </>
        )}
        <a href={publicUrl} className="mt-5 inline-block text-sm font-medium text-brand-600 hover:underline">
          Abrir minha página →
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-surface p-6">
      <div>
        <h2 className="text-lg font-semibold">Seja um embaixador de “{campaignTitle}”</h2>
        <p className="mt-1 text-sm text-muted">
          Crie sua própria página de arrecadação e mobilize a sua rede. Leva um minuto.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Seu nome" error={err("name")}>
          <Input name="name" maxLength={80} required autoComplete="name" />
        </Field>
        <Field label="Seu e-mail" error={err("email")} hint="Enviamos o link de edição para cá.">
          <Input name="email" type="email" maxLength={160} required autoComplete="email" />
        </Field>
      </div>

      <Field label="Frase de chamada" error={err("headline")} hint="Ex.: “Corro a maratona pela educação”. Opcional.">
        <Input name="headline" maxLength={120} />
      </Field>

      <Field label="Sua mensagem" error={err("message")} hint="Conte por que você abraçou essa causa. Opcional.">
        <Textarea name="message" rows={4} maxLength={2000} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sua meta (R$)" error={err("goalReais")} hint="Opcional.">
          <Input name="goalReais" inputMode="decimal" placeholder="1.000,00" />
        </Field>
        <Field label="Foto (URL)" error={err("photoUrl")} hint="Link de uma imagem sua. Opcional.">
          <Input name="photoUrl" type="url" placeholder="https://…/foto.jpg" />
        </Field>
      </div>

      {state?.error && !state.ok && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" loading={pending}>
        {pending ? "Criando…" : "Criar minha página"}
      </Button>
    </form>
  );
}

function CopyRow({ value, muted }: { value: string; muted?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <code className={`min-w-0 flex-1 truncate rounded-md bg-canvas px-2.5 py-1.5 text-xs ${muted ? "text-muted" : "text-ink"}`}>
        {value}
      </code>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked */
          }
        }}
      >
        {copied ? "Copiado!" : "Copiar"}
      </Button>
    </div>
  );
}
