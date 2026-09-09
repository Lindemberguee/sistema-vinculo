"use client";

import { useActionState } from "react";
import { createAuctionFormAction, updateAuctionFormAction, type AuctionResult } from "@/server/auction/actions";
import { Field, Input, Textarea, Select, Button } from "@/components/ui";

export interface AuctionFormValues {
  title: string;
  description: string;
  antiSnipeSeconds: string;
  campaignId: string;
}

const EMPTY: AuctionFormValues = { title: "", description: "", antiSnipeSeconds: "120", campaignId: "" };

export function AuctionForm({
  orgId,
  auctionId,
  campaigns,
  initial,
}: {
  orgId: string;
  auctionId?: string;
  campaigns: { id: string; title: string }[];
  initial?: Partial<AuctionFormValues>;
}) {
  const v = { ...EMPTY, ...initial };
  const action = auctionId
    ? updateAuctionFormAction.bind(null, orgId, auctionId)
    : createAuctionFormAction.bind(null, orgId);
  const [state, formAction, pending] = useActionState<AuctionResult | null, FormData>(action, null);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <Field label="Título" error={err("title")}>
        <Input name="title" defaultValue={v.title} required />
      </Field>
      <Field label="Descrição" error={err("description")}>
        <Textarea name="description" defaultValue={v.description} rows={3} required />
      </Field>
      <Field label="Anti-sniping (segundos)" error={err("antiSnipeSeconds")} hint="Lance nos últimos N segundos empurra o fim do lote.">
        <Input name="antiSnipeSeconds" defaultValue={v.antiSnipeSeconds} inputMode="numeric" />
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
          {pending ? "Salvando…" : auctionId ? "Salvar alterações" : "Criar leilão"}
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
