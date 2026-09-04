"use client";

import { useActionState } from "react";
import { createRaffleFormAction, updateRaffleFormAction, type RaffleResult } from "@/server/raffle/actions";
import { Field, Input, Textarea, Select, Button } from "@/components/ui";

export interface RaffleFormValues {
  title: string;
  description: string;
  prize: string;
  priceReais: string;
  totalNumbers: string;
  minPerPurchase: string;
  maxPerPurchase: string;
  drawAt: string;
  campaignId: string;
}

const EMPTY: RaffleFormValues = {
  title: "",
  description: "",
  prize: "",
  priceReais: "10",
  totalNumbers: "1000",
  minPerPurchase: "1",
  maxPerPurchase: "50",
  drawAt: "",
  campaignId: "",
};

export function RaffleForm({
  orgId,
  raffleId,
  campaigns,
  initial,
  locked,
}: {
  orgId: string;
  raffleId?: string;
  campaigns: { id: string; title: string }[];
  initial?: Partial<RaffleFormValues>;
  locked?: boolean;
}) {
  const v = { ...EMPTY, ...initial };
  const action = raffleId
    ? updateRaffleFormAction.bind(null, orgId, raffleId)
    : createRaffleFormAction.bind(null, orgId);
  const [state, formAction, pending] = useActionState<RaffleResult | null, FormData>(action, null);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <Field label="Título" error={err("title")}>
        <Input name="title" defaultValue={v.title} required />
      </Field>
      <Field label="Descrição" error={err("description")}>
        <Textarea name="description" defaultValue={v.description} rows={3} required />
      </Field>
      <Field label="Prêmio" error={err("prize")}>
        <Input name="prize" defaultValue={v.prize} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Preço por número (R$)" error={err("priceReais")}>
          <Input name="priceReais" defaultValue={v.priceReais} inputMode="decimal" required />
        </Field>
        <Field label="Total de números" error={err("totalNumbers")} hint={locked ? "Só pode aumentar após vendas" : undefined}>
          <Input name="totalNumbers" defaultValue={v.totalNumbers} inputMode="numeric" required />
        </Field>
        <Field label="Mínimo por compra" error={err("minPerPurchase")}>
          <Input name="minPerPurchase" defaultValue={v.minPerPurchase} inputMode="numeric" />
        </Field>
        <Field label="Máximo por compra" error={err("maxPerPurchase")}>
          <Input name="maxPerPurchase" defaultValue={v.maxPerPurchase} inputMode="numeric" />
        </Field>
      </div>
      <Field label="Data do sorteio (opcional)" error={err("drawAt")}>
        <Input name="drawAt" type="datetime-local" defaultValue={v.drawAt} />
      </Field>
      <Field label="Campanha (opcional)">
        <Select name="campaignId" defaultValue={v.campaignId}>
          <option value="">Nenhuma</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </Select>
      </Field>

      {state?.error && <p className="field-error">{state.error}</p>}
      {state?.ok && <p className="text-sm text-success">Salvo.</p>}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : raffleId ? "Salvar alterações" : "Criar rifa"}
        </Button>
      </div>
    </form>
  );
}
