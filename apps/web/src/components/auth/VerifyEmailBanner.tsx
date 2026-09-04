"use client";

import { useState, useTransition } from "react";
import { resendVerification } from "@/server/auth/actions";

/** Shown across the panel while the signed-in user hasn't confirmed their e-mail. */
export function VerifyEmailBanner() {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warn/30 bg-warn-bg px-3 py-2 text-sm text-warn">
      <span>Confirme seu e-mail para liberar todos os recursos.</span>
      {sent ? (
        <span className="text-xs">Enviamos um novo link.</span>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await resendVerification();
              if (res.ok) setSent(true);
            })
          }
          className="text-xs font-medium underline hover:no-underline disabled:opacity-50"
        >
          {pending ? "Enviando…" : "Reenviar confirmação"}
        </button>
      )}
    </div>
  );
}
