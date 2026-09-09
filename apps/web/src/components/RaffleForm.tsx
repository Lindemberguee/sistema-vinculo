"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
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
      {locked && (
        <p className="rounded-md bg-warn-bg px-3 py-2 text-xs text-warn">
          A rifa já teve vendas — total de números e preço só podem aumentar.
        </p>
      )}
      <Field label="Título" required error={err("title")}>
        <Input name="title" defaultValue={v.title} required />
      </Field>
      <Field label="Descrição" required error={err("description")}>
        <Textarea name="description" defaultValue={v.description} rows={3} required />
      </Field>
      <Field label="Prêmio" required error={err("prize")}>
        <Input name="prize" defaultValue={v.prize} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Preço por número (R$)" required error={err("priceReais")}>
          <Input name="priceReais" defaultValue={v.priceReais} inputMode="decimal" required />
        </Field>
        <Field
          label="Total de números"
          required
          error={err("totalNumbers")}
          hint={locked ? "Só pode aumentar após vendas" : undefined}
        >
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

      {state?.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {pending ? "Salvando…" : raffleId ? "Salvar alterações" : "Criar rifa"}
        </Button>
        {state?.ok && (
          <span className="inline-flex items-center gap-1.5 text-sm text-success" role="status" aria-live="polite">
            <Check className="size-4" aria-hidden />
            Salvo
          </span>
        )}
      </div>
    </form>
  );
}
