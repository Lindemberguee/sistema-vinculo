"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCampaignStatus } from "@/server/campaigns/actions";
import { Button, StatusBadge } from "@/components/ui";

export function CampaignStatusControls({
  orgId,
  campaignId,
  status,
}: {
  orgId: string;
  campaignId: string;
  status: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function go(next: "PAUSED" | "PUBLISHED" | "CLOSED") {
    start(async () => {
      await setCampaignStatus(orgId, campaignId, next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={status} />
      {status === "PUBLISHED" && (
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => go("PAUSED")}>
          Pausar
        </Button>
      )}
      {(status === "PAUSED" || status === "CLOSED") && (
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => go("PUBLISHED")}>
          Reativar
        </Button>
      )}
      {status !== "CLOSED" && (
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => go("CLOSED")} className="text-danger">
          Encerrar
        </Button>
      )}
    </div>
  );
}
