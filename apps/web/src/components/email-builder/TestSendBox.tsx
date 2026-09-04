"use client";

import { useActionState } from "react";
import { sendEmailTemplateTest } from "@/server/crm/email-templates";
import { Input, Button } from "@/components/ui";

/**
 * "Testar envio" — sends the current (possibly unsaved) template to any address
 * with sample data, so the operator can check it in a real inbox.
 */
export function TestSendBox({
  orgId,
  kind,
  subject,
  blocksJson,
}: {
  orgId: string;
  kind: string;
  subject: string;
  blocksJson: string;
}) {
  const [state, action, pending] = useActionState(
    sendEmailTemplateTest.bind(null, orgId, kind),
    null,
  );

  return (
    <form action={action} className="space-y-2 rounded-lg border border-line p-3">
      <div className="text-sm font-medium">Testar envio</div>
      <p className="text-xs text-muted">
        Manda este modelo (com dados de exemplo) para um e-mail, do remetente real da organização.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1">
          <span className="label">E-mail de destino</span>
          <Input type="email" name="to" required placeholder="voce@exemplo.org" className="w-56" />
        </label>
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? "Enviando…" : "Enviar teste"}
        </Button>
      </div>
      <input type="hidden" name="subject" value={subject} />
      <input type="hidden" name="blocksJson" value={blocksJson} />
      {state?.error && <p className="field-error">{state.error}</p>}
      {state?.ok && <p className="text-xs font-medium text-success">Teste enviado. Confira a caixa de entrada.</p>}
    </form>
  );
}
