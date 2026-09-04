"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveKyc, rejectKyc } from "@/server/admin/actions";
import { Button } from "@/components/ui";

export function AdminKycActions({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await approveKyc(orgId);
            if (!r.ok) setErr(r.error ?? "Falha");
            else router.refresh();
          })
        }
      >
        Aprovar
      </Button>
      <input
        placeholder="Motivo da recusa"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="input w-48 text-xs"
      />
      <Button
        size="sm"
        variant="danger"
        disabled={pending || reason.trim().length < 3}
        onClick={() =>
          start(async () => {
            const r = await rejectKyc(orgId, reason.trim());
            if (!r.ok) setErr(r.error ?? "Falha");
            else router.refresh();
          })
        }
      >
        Recusar
      </Button>
      {err && <span className="field-error">{err}</span>}
    </div>
  );
}
