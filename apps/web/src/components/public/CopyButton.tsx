"use client";

import { useState } from "react";
import { Check, Copy, Printer } from "lucide-react";

/** Copy-to-clipboard button for Pix "copia e cola" codes. */
export function CopyButton({ text, label = "Copiar código" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      /* clipboard unavailable — the code is shown in full next to the button */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      {done ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      {done ? "Copiado!" : label}
    </button>
  );
}

/** Trigger the browser print dialog (ticket pages). */
export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-canvas print:hidden"
    >
      <Printer className="size-3.5" />
      {label}
    </button>
  );
}
