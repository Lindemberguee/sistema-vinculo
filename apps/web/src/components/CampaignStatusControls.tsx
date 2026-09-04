"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCampaignStatus } from "@/server/campaigns/actions";
import { Alert, Button, StatusBadge } from "@/components/ui";

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
  const [feedback, setFeedback] = useState<string | null>(null);
  const router = useRouter();

  function go(next: "PAUSED" | "PUBLISHED" | "CLOSED") {
    start(async () => {
      setFeedback(null);
      const result = await setCampaignStatus(orgId, campaignId, next);
      if (!result.ok) {
        setFeedback(result.error ?? "Não foi possível atualizar o status.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={status} />
      {status === "PUBLISHED" && (
        <Button variant="secondary" size="sm" loading={pending} onClick={() => go("PAUSED")}>
          Pausar
        </Button>
      )}
      {(status === "PAUSED" || status === "CLOSED") && (
        <Button variant="secondary" size="sm" loading={pending} onClick={() => go("PUBLISHED")}>
          Reativar
        </Button>
      )}
      {status !== "CLOSED" && (
        <Button variant="secondary" size="sm" loading={pending} onClick={() => go("CLOSED")} className="text-danger">
          Encerrar
        </Button>
      )}
      {feedback && <Alert tone="danger">{feedback}</Alert>}
    </div>
  );
}
