"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateNotificationConfig } from "@/server/org/notifications";
import { Field, Textarea, Select, Checkbox, Button } from "@/components/ui";

export function TeamNotificationsForm({
  orgId,
  recipients,
  kycChanges,
  recurringFailed,
  dailyDigest,
  digestHour,
}: {
  orgId: string;
  recipients: string[];
  kycChanges: boolean;
  recurringFailed: boolean;
  dailyDigest: boolean;
  digestHour: number;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateNotificationConfig.bind(null, orgId), null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="grid gap-4">
      <Field
        label="E-mails da equipe"
        hint="Um por linha (ou separados por vírgula). Máx. 10. Estes alertas são internos — os doadores não recebem."
      >
        <Textarea name="recipients" rows={3} defaultValue={recipients.join("\n")} placeholder="fulano@ong.org" />
      </Field>

      <div className="grid gap-2">
        <Checkbox name="kycChanges" defaultChecked={kycChanges} label="Quando o KYC muda de status (aprovado / recusado)" />
        <Checkbox
          name="recurringFailed"
          defaultChecked={recurringFailed}
          label="Quando uma doação recorrente é encerrada por falha de cobrança"
        />
        <Checkbox name="dailyDigest" defaultChecked={dailyDigest} label="Resumo diário (arrecadação, novos doadores, pendências)" />
      </div>

      <Field label="Hora do resumo diário" hint="Horário do servidor (fuso de Brasília).">
        <Select name="digestHour" defaultValue={String(digestHour)} className="w-28">
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")}:00
            </option>
          ))}
        </Select>
      </Field>

      {state?.error && <p className="field-error">{state.error}</p>}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
