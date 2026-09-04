"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatBRL } from "@donation/shared";
import { addLot, removeLot, setAuctionStatus, updateLot } from "@/server/auction/actions";
import { Button, Field, Input, Textarea } from "@/components/ui";

export function AuctionStatusControls({
  orgId,
  auctionId,
  status,
}: {
  orgId: string;
  auctionId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const go = (next: "OPEN" | "ENDED" | "SETTLED" | "CANCELED") =>
    start(async () => {
      const r = await setAuctionStatus(orgId, auctionId, next);
      if (!r.ok) setErr(r.error ?? "Falha");
      else {
        setErr(null);
        router.refresh();
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(status === "DRAFT" || status === "ENDED") && (
        <Button size="sm" disabled={pending} onClick={() => go("OPEN")}>
          {status === "ENDED" ? "Reabrir" : "Abrir leilão"}
        </Button>
      )}
      {status === "OPEN" && (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => go("ENDED")}>
          Encerrar
        </Button>
      )}
      {status === "ENDED" && (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => go("SETTLED")}>
          Marcar como concluído
        </Button>
      )}
      {status !== "CANCELED" && status !== "SETTLED" && (
        <Button size="sm" variant="secondary" className="text-danger" disabled={pending} onClick={() => go("CANCELED")}>
          Cancelar
        </Button>
      )}
      {err && <span className="field-error">{err}</span>}
    </div>
  );
}

interface LotRow {
  id: string;
  title: string;
  description: string;
  photoUrl: string | null;
  startPriceCents: number;
  minIncrementCents: number;
  endsAt: string;
  status: string;
  bidCount: number;
  currentBidCents: number | null;
  winningBidCents: number | null;
}

const centsToReais = (n: number) => (n / 100).toString().replace(".", ",");
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function LotManager({ orgId, auctionId, lots }: { orgId: string; auctionId: string; lots: LotRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setErr(r.error ?? "Falha");
      else {
        setErr(null);
        router.refresh();
      }
    });

  return (
    <div className="grid gap-3">
      {lots.map((l) => (
        <form
          key={l.id}
          action={(fd) => run(() => updateLot(orgId, l.id, fd))}
          className="grid gap-2 rounded-lg border border-line p-3"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Título">
              <Input name="title" defaultValue={l.title} required />
            </Field>
            <Field label="Foto (URL)">
              <Input name="photoUrl" type="url" defaultValue={l.photoUrl ?? ""} />
            </Field>
          </div>
          <Field label="Descrição">
            <Textarea name="description" defaultValue={l.description} rows={2} required />
          </Field>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Lance inicial R$">
              <Input name="startPriceReais" defaultValue={centsToReais(l.startPriceCents)} inputMode="decimal" />
            </Field>
            <Field label="Incremento mín. R$">
              <Input name="minIncrementReais" defaultValue={centsToReais(l.minIncrementCents)} inputMode="decimal" />
            </Field>
            <Field label="Encerra em">
              <Input name="endsAt" type="datetime-local" defaultValue={toLocalInput(l.endsAt)} required />
            </Field>
          </div>
          <p className="text-xs text-muted">
            {l.status} · {l.bidCount} lances
            {l.currentBidCents ? ` · atual ${formatBRL(l.currentBidCents)}` : ""}
            {l.winningBidCents ? ` · arrematado por ${formatBRL(l.winningBidCents)}` : ""}
          </p>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={pending}>
              Salvar
            </Button>
            {l.bidCount === 0 && (
              <Button
                size="sm"
                variant="secondary"
                type="button"
                className="text-danger"
                disabled={pending}
                onClick={() => run(() => removeLot(orgId, l.id))}
              >
                Remover
              </Button>
            )}
          </div>
        </form>
      ))}

      <form action={(fd) => run(() => addLot(orgId, auctionId, fd))} className="grid gap-2 rounded-lg border border-dashed border-line p-3">
        <p className="label">Novo lote</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Título">
            <Input name="title" placeholder="Quadro assinado" required />
          </Field>
          <Field label="Foto (URL)">
            <Input name="photoUrl" type="url" />
          </Field>
        </div>
        <Field label="Descrição">
          <Textarea name="description" rows={2} required />
        </Field>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Lance inicial R$">
            <Input name="startPriceReais" placeholder="200" inputMode="decimal" />
          </Field>
          <Field label="Incremento mín. R$">
            <Input name="minIncrementReais" placeholder="50" inputMode="decimal" />
          </Field>
          <Field label="Encerra em">
            <Input name="endsAt" type="datetime-local" required />
          </Field>
        </div>
        <Button size="sm" type="submit" disabled={pending}>
          Adicionar lote
        </Button>
      </form>
      {err && <p className="field-error">{err}</p>}
    </div>
  );
}
