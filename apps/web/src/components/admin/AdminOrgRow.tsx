"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminChangePlan, markSubscriptionPaid, setOrgStatus } from "@/server/admin/billing";
import { Select, Button } from "@/components/ui";

export function AdminOrgActions({
  orgId,
  planId,
  orgStatus,
  plans,
}: {
  orgId: string;
  planId: string;
  orgStatus: string;
  plans: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) alert(r.error ?? "Falha");
      else router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        defaultValue={planId}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          if (next !== planId) run(() => adminChangePlan(orgId, next));
        }}
        className="h-8 w-32 text-xs"
      >
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => run(() => markSubscriptionPaid(orgId))}
      >
        Marcar pago
      </Button>
      {orgStatus === "SUSPENDED" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setOrgStatus(orgId, "ACTIVE"))}
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          Reativar
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => confirm("Suspender esta organização? O site público sai do ar.") && run(() => setOrgStatus(orgId, "SUSPENDED"))}
          className="text-xs text-muted hover:text-danger"
        >
          Suspender
        </button>
      )}
    </div>
  );
}
