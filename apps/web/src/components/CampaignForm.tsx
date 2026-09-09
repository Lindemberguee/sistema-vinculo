"use client";

import { useActionState } from "react";
import {
  createCampaignFormAction,
  updateCampaignFormAction,
  type ActionResult,
} from "@/server/campaigns/actions";
import { Field, Input, Textarea, Select, Checkbox, Button } from "@/components/ui";

export interface CampaignFormValues {
  title: string;
  slug: string;
  summary: string;
  type: string;
  goalReais: string;
  minAmountReais: string;
  suggestedAmountsReais: string;
  allowRecurring: boolean;
  allowTip: boolean;
  seoTitle: string;
  seoDescription: string;
}

const EMPTY: CampaignFormValues = {
  title: "",
  slug: "",
  summary: "",
  type: "DONATION",
  goalReais: "",
  minAmountReais: "5",
  suggestedAmountsReais: "20, 50, 100, 250",
  allowRecurring: true,
  allowTip: true,
  seoTitle: "",
  seoDescription: "",
};

export function CampaignForm({
  orgId,
  campaignId,
  initial,
}: {
  orgId: string;
  campaignId?: string;
  initial?: Partial<CampaignFormValues>;
}) {
  const values = { ...EMPTY, ...initial };
  const boundAction = campaignId
    ? updateCampaignFormAction.bind(null, orgId, campaignId)
    : createCampaignFormAction.bind(null, orgId);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(boundAction, null);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <Field label="Título" error={err("title")}>
        <Input name="title" defaultValue={values.title} required />
      </Field>

      <Field label="Endereço (slug)" error={err("slug")} hint="Aparece na URL: slug.suaong.plataforma.com.br">
        <Input name="slug" defaultValue={values.slug} required />
      </Field>

      <Field label="Resumo" error={err("summary")}>
        <Textarea name="summary" defaultValue={values.summary} rows={2} />
      </Field>

      <Field label="Tipo" error={err("type")}>
        <Select name="type" defaultValue={values.type}>
          <option value="DONATION">Doação</option>
          <option value="CROWDFUNDING">Vaquinha (com meta)</option>
          <option value="APADRINHAMENTO">Apadrinhamento</option>
          <option value="EVENT">Evento</option>
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Meta (R$, opcional)" error={err("goalReais")}>
          <Input name="goalReais" defaultValue={values.goalReais} inputMode="decimal" />
        </Field>
        <Field label="Valor mínimo (R$)" error={err("minAmountReais")}>
          <Input name="minAmountReais" defaultValue={values.minAmountReais} inputMode="decimal" required />
        </Field>
      </div>

      <Field label="Valores sugeridos (R$, separados por vírgula)">
        <Input name="suggestedAmountsCents" defaultValue={values.suggestedAmountsReais} />
      </Field>

      <Checkbox name="allowRecurring" value="true" defaultChecked={values.allowRecurring} label="Permitir doação mensal" />
      <Checkbox
        name="allowTip"
        value="true"
        defaultChecked={values.allowTip}
        label="Permitir uma contribuição extra à causa"
      />

      <fieldset className="grid gap-3 rounded-lg border border-line p-4">
        <legend className="px-1 text-xs text-muted">SEO</legend>
        <Field label="Título para buscadores">
          <Input name="seoTitle" defaultValue={values.seoTitle} />
        </Field>
        <Field label="Descrição para buscadores">
          <Textarea name="seoDescription" defaultValue={values.seoDescription} rows={2} />
        </Field>
      </fieldset>

      {state?.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {pending ? "Salvando…" : campaignId ? "Salvar alterações" : "Criar campanha"}
        </Button>
        {state?.ok && (
          <span className="text-sm text-success" role="status" aria-live="polite">
            Salvo
          </span>
        )}
      </div>
    </form>
  );
}
