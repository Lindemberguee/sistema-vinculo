"use client";

import { useActionState } from "react";
import { saveCampaignSettingsExtra, type ActionResult } from "@/server/campaigns/actions";
import { Field, Textarea, Checkbox } from "@/components/ui";
import { SectionCard, SaveBar } from "./EssentialTab";

export interface SettingsValues {
  notifyEmails: string;
  hiddenFromDirectory: boolean;
  dedicationEnabled: boolean;
  allowAmbassadors: boolean;
}

export function SettingsTab({
  orgId,
  campaignId,
  initial,
}: {
  orgId: string;
  campaignId: string;
  initial: SettingsValues;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveCampaignSettingsExtra.bind(null, orgId, campaignId),
    null,
  );

  return (
    <form action={action} className="space-y-5">
      <SectionCard title="Avisos por e-mail" desc="Quem recebe um e-mail a cada doação nesta campanha.">
        <Field label="E-mails de notificação" hint="Um endereço por linha. Até 10.">
          <Textarea name="notifyEmails" defaultValue={initial.notifyEmails} rows={3} placeholder="financeiro@suaong.org.br" />
        </Field>
      </SectionCard>

      <SectionCard title="Opções da doação" desc="Detalhes que aparecem para o doador.">
        <Checkbox
          name="dedicationEnabled"
          value="true"
          defaultChecked={initial.dedicationEnabled}
          label="Permitir dedicar a doação a alguém (mensagem comemorativa)"
        />
        <Checkbox
          name="allowAmbassadors"
          value="true"
          defaultChecked={initial.allowAmbassadors}
          label="Aceitar embaixadores — outras pessoas podem arrecadar em nome da campanha"
        />
      </SectionCard>

      <SectionCard title="Visibilidade" desc="Onde a campanha aparece.">
        <Checkbox
          name="hiddenFromDirectory"
          value="true"
          defaultChecked={initial.hiddenFromDirectory}
          label="Ocultar do diretório público (continua acessível pelo link direto)"
        />
      </SectionCard>

      <SaveBar state={state} pending={pending} />
    </form>
  );
}
