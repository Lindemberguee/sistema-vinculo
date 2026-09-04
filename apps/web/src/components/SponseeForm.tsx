"use client";

import { useActionState } from "react";
import {
  createSponseeFormAction,
  updateSponseeFormAction,
  type SponseeResult,
} from "@/server/sponsees/actions";
import { Field, Input, Textarea, Select, Button } from "@/components/ui";

export interface SponseeFormValues {
  name: string;
  category: string;
  story: string;
  photoUrl: string;
  birthYear: string;
  monthlyReais: string;
  campaignId: string;
}

const EMPTY: SponseeFormValues = {
  name: "",
  category: "Criança",
  story: "",
  photoUrl: "",
  birthYear: "",
  monthlyReais: "50",
  campaignId: "",
};

export function SponseeForm({
  orgId,
  sponseeId,
  campaigns,
  initial,
}: {
  orgId: string;
  sponseeId?: string;
  campaigns: { id: string; title: string }[];
  initial?: Partial<SponseeFormValues>;
}) {
  const v = { ...EMPTY, ...initial };
  const action = sponseeId
    ? updateSponseeFormAction.bind(null, orgId, sponseeId)
    : createSponseeFormAction.bind(null, orgId);
  const [state, formAction, pending] = useActionState<SponseeResult | null, FormData>(action, null);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" error={err("name")}>
          <Input name="name" defaultValue={v.name} required />
        </Field>
        <Field label="Categoria" error={err("category")}>
          <Input name="category" defaultValue={v.category} required placeholder="Criança, Animal, Idoso…" />
        </Field>
        <Field label="Ano de nascimento (opcional)" error={err("birthYear")}>
          <Input name="birthYear" defaultValue={v.birthYear} inputMode="numeric" placeholder="2015" />
        </Field>
        <Field label="Valor mensal (R$)" error={err("monthlyReais")}>
          <Input name="monthlyReais" defaultValue={v.monthlyReais} inputMode="decimal" required />
        </Field>
      </div>
      <Field label="História" error={err("story")}>
        <Textarea name="story" defaultValue={v.story} rows={5} required />
      </Field>
      <Field label="Foto (URL)" error={err("photoUrl")} hint="Cole o link de uma imagem hospedada.">
        <Input name="photoUrl" defaultValue={v.photoUrl} type="url" />
      </Field>
      <Field label="Campanha (opcional)">
        <Select name="campaignId" defaultValue={v.campaignId}>
          <option value="">Nenhuma (aparece na grade geral)</option>
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
          {pending ? "Salvando…" : sponseeId ? "Salvar alterações" : "Criar afilhado"}
        </Button>
      </div>
    </form>
  );
}
