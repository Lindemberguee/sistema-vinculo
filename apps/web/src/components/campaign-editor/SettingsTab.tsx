"use client";

import { useActionState, useState } from "react";
import { saveCampaignSettingsExtra, type ActionResult } from "@/server/campaigns/actions";
import { Field, Textarea, Switch } from "@/components/ui";
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
  const [dedication, setDedication] = useState(initial.dedicationEnabled);
  const [ambassadors, setAmbassadors] = useState(initial.allowAmbassadors);
  const [hidden, setHidden] = useState(initial.hiddenFromDirectory);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="dedicationEnabled" value={dedication ? "true" : ""} />
      <input type="hidden" name="allowAmbassadors" value={ambassadors ? "true" : ""} />
      <input type="hidden" name="hiddenFromDirectory" value={hidden ? "true" : ""} />

      <SectionCard title="Avisos por e-mail" desc="Quem recebe um e-mail a cada doação nesta campanha.">
        <Field label="E-mails de notificação" hint="Um endereço por linha. Até 10.">
          <Textarea
            name="notifyEmails"
            defaultValue={initial.notifyEmails}
            rows={3}
            placeholder="financeiro@suaong.org.br"
          />
        </Field>
      </SectionCard>

      <SectionCard title="Opções da doação" desc="Detalhes que aparecem para o doador.">
        <div className="grid gap-3">
          <Switch
            checked={dedication}
            onCheckedChange={setDedication}
            label="Permitir dedicar a doação a alguém"
            description="O doador pode adicionar uma mensagem comemorativa."
          />
          <Switch
            checked={ambassadors}
            onCheckedChange={setAmbassadors}
            label="Aceitar embaixadores"
            description="Outras pessoas podem arrecadar em nome da campanha."
          />
        </div>
      </SectionCard>

      <SectionCard title="Visibilidade" desc="Onde a campanha aparece.">
        <Switch
          checked={hidden}
          onCheckedChange={setHidden}
          label="Ocultar do diretório público"
          description="A campanha continua acessível pelo link direto."
        />
      </SectionCard>

      <SaveBar state={state} pending={pending} />
    </form>
  );
}
