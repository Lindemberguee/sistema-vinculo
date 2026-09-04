"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestExport, triggerRfm } from "@/server/crm/actions";
import { Button } from "@/components/ui";

export function ExportPanel({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const gen = (kind: "donors" | "donations") =>
    start(async () => {
      const r = await requestExport(orgId, { kind });
      setMsg(r.ok ? "Exportação na fila — atualize em alguns segundos." : (r.error ?? "Falha"));
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Button size="sm" disabled={pending} onClick={() => gen("donors")}>
        Exportar doadores
      </Button>
      <Button size="sm" disabled={pending} onClick={() => gen("donations")}>
        Exportar doações
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await triggerRfm(orgId);
            setMsg(r.ok ? "Recalculando segmentos RFM…" : (r.error ?? "Falha"));
          })
        }
      >
        Recalcular RFM
      </Button>
      {msg && <span className="text-sm text-muted">{msg}</span>}
    </div>
  );
}
