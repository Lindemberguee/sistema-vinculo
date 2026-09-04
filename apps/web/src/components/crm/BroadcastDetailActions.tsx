"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteBroadcast,
  duplicateBroadcast,
  sendExistingBroadcast,
  unscheduleBroadcast,
} from "@/server/crm/broadcasts";
import { Button } from "@/components/ui";

export function BroadcastDetailActions({
  orgId,
  broadcastId,
  status,
  recipientCount,
}: {
  orgId: string;
  broadcastId: string;
  status: string;
  recipientCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, afterOk?: () => void) =>
    start(async () => {
      setErr(null);
      const r = await fn();
      if (!r.ok) setErr(r.error ?? "Falha");
      else if (afterOk) afterOk();
      else router.refresh();
    });

  const canSend = status === "DRAFT" || status === "FAILED" || status === "SCHEDULED";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {err && <span className="field-error w-full text-right sm:w-auto">{err}</span>}

      {canSend && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            if (confirm(`Enviar para ${recipientCount} doador(es) agora? Não dá para desfazer.`))
              run(() => sendExistingBroadcast(orgId, broadcastId));
          }}
        >
          {pending ? "…" : status === "SCHEDULED" ? "Enviar agora" : "Enviar"}
        </Button>
      )}

      {status === "SCHEDULED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => unscheduleBroadcast(orgId, broadcastId))}
          className="btn-secondary btn-sm"
        >
          Cancelar agendamento
        </button>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => duplicateBroadcast(orgId, broadcastId))}
        className="btn-secondary btn-sm"
      >
        Duplicar
      </button>

      {status !== "SENT" && status !== "SENDING" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            confirm("Excluir esta mensagem?") &&
            run(
              () => deleteBroadcast(orgId, broadcastId),
              () => router.push(`/orgs/${orgId}/broadcasts`),
            )
          }
          className="text-xs text-muted hover:text-danger"
        >
          Excluir
        </button>
      )}
    </div>
  );
}
