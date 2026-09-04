"use client";

import { useActionState } from "react";
import { saveCampaignFundraising, type ActionResult } from "@/server/campaigns/actions";
import { Field, Input, Select, Checkbox } from "@/components/ui";
import { SectionCard, SaveBar } from "./EssentialTab";

export interface FundraisingValues {
  type: string;
  goalReais: string;
  superGoalReais: string;
  minAmountReais: string;
  suggestedAmountsReais: string;
  allowRecurring: boolean;
  allowTip: boolean;
  endsAt: string;
  offPlatformReais: string;
}

export function FundraisingTab({
  orgId,
  campaignId,
  initial,
}: {
  orgId: string;
  campaignId: string;
  initial: FundraisingValues;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveCampaignFundraising.bind(null, orgId, campaignId),
    null,
  );
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  return (
    <form action={action} className="space-y-5">
      <SectionCard title="Tipo de campanha" desc="Como as pessoas vão doar para esta campanha.">
        <Field label="Tipo" error={err("type")}>
          <Select name="type" defaultValue={initial.type}>
            <option value="DONATION">Doação</option>
            <option value="CROWDFUNDING">Vaquinha (com meta)</option>
            <option value="APADRINHAMENTO">Apadrinhamento</option>
            <option value="EVENT">Evento</option>
          </Select>
        </Field>
      </SectionCard>

      <SectionCard title="Meta e prazo" desc="Quanto a campanha precisa arrecadar e até quando fica no ar.">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Meta (R$)" error={err("goalReais")} hint="Sem meta, a página não mostra barra de progresso.">
            <Input name="goalReais" defaultValue={initial.goalReais} inputMode="decimal" placeholder="0,00" />
          </Field>
          <Field label="Super meta (R$)" error={err("superGoalReais")} hint="Mostrada depois de bater a meta.">
            <Input name="superGoalReais" defaultValue={initial.superGoalReais} inputMode="decimal" placeholder="0,00" />
          </Field>
        </div>
        <Field label="Data de término" error={err("endsAt")} hint="A campanha fica no ar até 23h59 (Brasília) da data escolhida.">
          <Input name="endsAt" type="datetime-local" defaultValue={initial.endsAt} />
        </Field>
      </SectionCard>

      <SectionCard title="Valores" desc="O que o doador vê ao abrir o checkout.">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Valor mínimo (R$)" error={err("minAmountReais")}>
            <Input name="minAmountReais" defaultValue={initial.minAmountReais} inputMode="decimal" required />
          </Field>
          <Field label="Valores sugeridos (R$)" hint="Separados por vírgula.">
            <Input name="suggestedAmountsCents" defaultValue={initial.suggestedAmountsReais} />
          </Field>
        </div>
        <Checkbox name="allowRecurring" value="true" defaultChecked={initial.allowRecurring} label="Permitir doação mensal" />
        <Checkbox name="allowTip" value="true" defaultChecked={initial.allowTip} label="Permitir contribuição extra à causa" />
      </SectionCard>

      <SectionCard title="Doações fora da plataforma" desc="Valores recebidos por fora que devem contar no total da campanha.">
        <Field label="Total recebido por fora (R$)" error={err("offPlatformReais")}>
          <Input name="offPlatformReais" defaultValue={initial.offPlatformReais} inputMode="decimal" placeholder="0,00" />
        </Field>
      </SectionCard>

      <SaveBar state={state} pending={pending} />
    </form>
  );
}
