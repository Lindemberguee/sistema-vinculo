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
      {(status === "DRAFT" || status === "CLOSED") && (
        <Button size="sm" disabled={pending} onClick={() => go("OPEN")}>
          {status === "CLOSED" ? "Reabrir" : "Abrir vendas"}
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

export function RaffleDrawForm({ orgId, raffleId }: { orgId: string; raffleId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [seed, setSeed] = useState("");
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="grid gap-2">
      <p className="hint">
        Cole um valor público como semente (ex.: resultado da Loteria Federal). Deixe em branco para gerar um aleatório.
        O sorteio é auditável: <code>índice = sha256(semente) mod nº de bilhetes pagos</code>, bilhetes ordenados pelo número.
      </p>
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="Semente pública (opcional)"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
        />
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await drawRaffle(orgId, raffleId, seed);
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
