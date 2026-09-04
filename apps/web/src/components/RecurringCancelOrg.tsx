"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelRecurringForOrg } from "@/server/recurring/actions";

export function RecurringCancelOrg({ orgId, planId }: { orgId: string; planId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await cancelRecurringForOrg(orgId, planId);
            if (!r.ok) setError(r.error ?? "Falha");
            else router.refresh();
          })
        }
        className="rounded-md border border-line bg-surface px-2 py-0.5 text-xs text-danger hover:bg-canvas disabled:opacity-50"
      >
        {pending ? "…" : "Cancelar"}
      </button>
      {error && <span className="field-error"> {error}</span>}
    </>
  );
}
