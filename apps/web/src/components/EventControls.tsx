"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatBRL } from "@donation/shared";
import {
  addTicketType,
  removeTicketType,
  setEventStatus,
  updateTicketType,
} from "@/server/events/actions";
import { Button, Field, Input } from "@/components/ui";

export function EventStatusControls({ orgId, eventId, status }: { orgId: string; eventId: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const go = (next: "PUBLISHED" | "ENDED" | "CANCELED") =>
    start(async () => {
      const r = await setEventStatus(orgId, eventId, next);
      if (!r.ok) setErr(r.error ?? "Falha");
      else {
        setErr(null);
        router.refresh();
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(status === "DRAFT" || status === "ENDED") && (
        <Button size="sm" disabled={pending} onClick={() => go("PUBLISHED")}>
          {status === "ENDED" ? "Reabrir vendas" : "Publicar / abrir vendas"}
        </Button>
      )}
      {status === "PUBLISHED" && (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => go("ENDED")}>
          Encerrar vendas
        </Button>
      )}
      {status !== "CANCELED" && status !== "ENDED" && (
        <Button size="sm" variant="secondary" className="text-danger" disabled={pending} onClick={() => go("CANCELED")}>
          Cancelar evento
        </Button>
      )}
      {err && <span className="field-error">{err}</span>}
    </div>
  );
}

interface TT {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
  sold: number;
  maxPerOrder: number;
}

export function TicketTypeManager({ orgId, eventId, types }: { orgId: string; eventId: string; types: TT[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const submitNew = (fd: FormData) =>
    start(async () => {
      const r = await addTicketType(orgId, eventId, fd);
      if (!r.ok) setErr(r.error ?? "Falha");
      else {
        setErr(null);
        router.refresh();
      }
    });

  return (
    <div className="grid gap-3">
      {types.map((t) => (
        <form
          key={t.id}
          action={(fd) =>
            start(async () => {
              const r = await updateTicketType(orgId, t.id, fd);
              if (!r.ok) setErr(r.error ?? "Falha");
              else {
                setErr(null);
                router.refresh();
              }
            })
          }
          className="grid items-end gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_100px_90px_90px_auto]"
        >
          <Field label="Nome">
            <Input name="name" defaultValue={t.name} required />
          </Field>
          <Field label="Preço R$">
            <Input name="priceReais" defaultValue={(t.priceCents / 100).toString().replace(".", ",")} inputMode="decimal" />
          </Field>
          <Field label="Qtd">
            <Input name="quantity" defaultValue={String(t.quantity)} inputMode="numeric" />
          </Field>
          <Field label="Máx/pedido">
            <Input name="maxPerOrder" defaultValue={String(t.maxPerOrder)} inputMode="numeric" />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={pending}>
              Salvar
            </Button>
            {t.sold === 0 && (
              <Button
                size="sm"
                variant="secondary"
                type="button"
                className="text-danger"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await removeTicketType(orgId, t.id);
                    router.refresh();
                  })
                }
              >
                Remover
              </Button>
            )}
          </div>
          <p className="text-xs text-muted sm:col-span-5">
            Vendidos: {t.sold} / {t.quantity} · receita {formatBRL(t.sold * t.priceCents)}
          </p>
        </form>
      ))}

      <form action={submitNew} className="grid items-end gap-2 rounded-lg border border-dashed border-line p-3 sm:grid-cols-[1fr_100px_90px_90px_auto]">
        <Field label="Novo tipo">
          <Input name="name" placeholder="Inteira" required />
        </Field>
        <Field label="Preço R$">
          <Input name="priceReais" placeholder="80" inputMode="decimal" />
        </Field>
        <Field label="Qtd">
          <Input name="quantity" placeholder="100" inputMode="numeric" required />
        </Field>
        <Field label="Máx/pedido">
          <Input name="maxPerOrder" defaultValue="6" inputMode="numeric" />
        </Field>
        <Button size="sm" type="submit" disabled={pending}>
          Adicionar
        </Button>
      </form>
      {err && <p className="field-error">{err}</p>}
    </div>
  );
}
