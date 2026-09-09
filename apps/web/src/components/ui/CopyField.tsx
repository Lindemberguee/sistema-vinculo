"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "./cn";

/**
 * Read-only value with a copy button. One implementation for every "copy this
 * webhook URL / token / link" spot; announces the copy to screen readers.
 */
export function CopyField({
  label,
  value,
  className,
}: {
  label?: string;
  value: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      /* clipboard blocked — nothing we can do */
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && <span className="w-16 shrink-0 text-xs text-muted">{label}</span>}
      <code className="min-w-0 flex-1 truncate rounded-md border border-line bg-canvas px-2.5 py-1.5 text-xs">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={done ? "Copiado" : `Copiar ${label ?? "valor"}`}
        className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-line-strong px-2.5 text-xs font-medium text-muted transition-colors hover:bg-canvas hover:text-ink"
      >
        {done ? (
          <>
            <Check className="size-3.5 text-success" aria-hidden /> Copiado
          </>
        ) : (
          <>
            <Copy className="size-3.5" aria-hidden /> Copiar
          </>
        )}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {done ? "Copiado para a área de transferência" : ""}
      </span>
    </div>
  );
}
