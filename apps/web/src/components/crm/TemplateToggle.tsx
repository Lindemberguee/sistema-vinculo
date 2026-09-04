"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleEmailTemplate } from "@/server/crm/email-templates";
import { cn } from "@/components/ui";

export function TemplateToggle({ orgId, kind, enabled }: { orgId: string; kind: string; enabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? "Desligar" : "Ligar"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await toggleEmailTemplate(orgId, kind);
          router.refresh();
        })
      }
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50",
        enabled ? "bg-brand-600" : "bg-line-strong",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4 rounded-full bg-white transition-transform",
          enabled ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
