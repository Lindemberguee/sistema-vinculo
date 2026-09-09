"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { CampaignForm } from "./CampaignForm";

/** Opens the "create a campaign" form in a modal — the org lands in the block
 * editor right after. Used both in the page header and in the empty state. */
export function NewCampaignButton({
  orgId,
  variant = "primary",
  children,
}: {
  orgId: string;
  variant?: "primary" | "secondary";
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant={variant} onClick={() => setOpen(true)}>
        {children ?? (
          <>
            <Plus className="size-4 shrink-0" aria-hidden />
            Nova campanha
          </>
        )}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nova campanha"
        description="Depois de criar você vai direto para o editor."
      >
        <CampaignForm orgId={orgId} />
      </Modal>
    </>
  );
}
