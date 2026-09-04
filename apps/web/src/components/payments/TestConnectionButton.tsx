"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { testGatewayConnection } from "@/server/payments/actions";
import { Button } from "@/components/ui";

export function TestConnectionButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setResult(null);
            const r = await testGatewayConnection(orgId);
            setResult({ ok: r.ok, msg: r.ok ? "Conexão OK." : r.error ?? "Falhou." });
            if (r.ok) router.refresh();
          })
        }
      >
        {pending ? "Testando…" : "Testar conexão"}
      </Button>
      {result && (
        <span className={`text-sm ${result.ok ? "text-success" : "field-error"}`}>{result.msg}</span>
      )}
    </div>
  );
}
