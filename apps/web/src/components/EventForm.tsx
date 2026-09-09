"use client";

import { useActionState } from "react";
import { createEventFormAction, updateEventFormAction, type EventResult } from "@/server/events/actions";
import { Field, Input, Textarea, Select, Button } from "@/components/ui";

export interface EventFormValues {
  title: string;
  description: string;
  venue: string;
  address: string;
  startsAt: string;
  endsAt: string;
  campaignId: string;
}

const EMPTY: EventFormValues = { title: "", description: "", venue: "", address: "", startsAt: "", endsAt: "", campaignId: "" };

export function EventForm({
  orgId,
  eventId,
  campaigns,
  initial,
}: {
  orgId: string;
  eventId?: string;
  campaigns: { id: string; title: string }[];
  initial?: Partial<EventFormValues>;
}) {
  const v = { ...EMPTY, ...initial };
  const action = eventId ? updateEventFormAction.bind(null, orgId, eventId) : createEventFormAction.bind(null, orgId);
  const [state, formAction, pending] = useActionState<EventResult | null, FormData>(action, null);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <Field label="Título" error={err("title")}>
        <Input name="title" defaultValue={v.title} required />
      </Field>
      <Field label="Descrição" error={err("description")}>
        <Textarea name="description" defaultValue={v.description} rows={3} required />
      </Field>
      <Field label="Local" error={err("venue")}>
        <Input name="venue" defaultValue={v.venue} required />
      </Field>
      <Field label="Endereço (opcional)" error={err("address")}>
        <Input name="address" defaultValue={v.address} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Início" error={err("startsAt")}>
          <Input name="startsAt" type="datetime-local" defaultValue={v.startsAt} required />
        </Field>
        <Field label="Fim (opcional)" error={err("endsAt")}>
          <Input name="endsAt" type="datetime-local" defaultValue={v.endsAt} />
        </Field>
      </div>
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
          {pending ? "Salvando…" : eventId ? "Salvar alterações" : "Criar evento"}
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
