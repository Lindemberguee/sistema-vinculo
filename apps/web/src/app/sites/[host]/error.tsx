"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-5">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-line bg-surface text-warn shadow-card">
          <TriangleAlert className="size-5" aria-hidden />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight">Algo deu errado</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Não conseguimos carregar esta página agora. Tente novamente em instantes.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex min-h-11 items-center rounded-full bg-brand-600 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
