"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { drawRaffle, setRaffleStatus } from "@/server/raffle/actions";
import { Button } from "@/components/ui";

export function RaffleStatusControls({
  orgId,
  raffleId,
  status,
}: {
  orgId: string;
  raffleId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const go = (next: "OPEN" | "CLOSED" | "CANCELED") =>
    start(async () => {
      const r = await setRaffleStatus(orgId, raffleId, next);
      if (!r.ok) setErr(r.error ?? "Falha");
      else {
        setErr(null);
        router.refresh();
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" && (
        <Button size="sm" disabled={pending} onClick={() => go("OPEN")}>
          Abrir vendas
        </Button>
      )}
      {status === "OPEN" && (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => go("CLOSED")}>
          Fechar vendas
        </Button>
      )}
      {status !== "DRAWN" && status !== "CANCELED" && (
        <Button size="sm" variant="secondary" className="text-danger" disabled={pending} onClick={() => go("CANCELED")}>
          Cancelar rifa
        </Button>
      )}
      {err && <span className="field-error">{err}</span>}
    </div>
  );
}

export function RaffleDrawForm({ orgId, raffleId, drawSeed }: { orgId: string; raffleId: string; drawSeed: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="grid gap-2">
      <p className="hint">
        A semente foi gerada pelo servidor no fechamento das vendas e não pode ser alterada pelo operador.
        O sorteio é auditável: <code>índice = sha256(semente) mod nº de bilhetes pagos</code>, bilhetes ordenados pelo número.
      </p>
      <div className="flex gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-canvas px-2.5 py-1.5 text-xs">{drawSeed ?? "será gerada ao sortear"}</code>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await drawRaffle(orgId, raffleId, "");
              if (!r.ok) setErr(r.error ?? "Falha");
              else {
                setErr(null);
                router.refresh();
              }
            })
          }
        >
          {pending ? "Sorteando…" : "Sortear"}
        </Button>
      </div>
      {err && <p className="field-error">{err}</p>}
    </div>
  );
}
