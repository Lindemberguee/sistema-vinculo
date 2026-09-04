"use client";

import { useEffect } from "react";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-8 text-center">
        <p className="text-3xl">⚠️</p>
        <h1 className="mt-3 text-lg font-semibold">Algo deu errado</h1>
        <p className="mt-1 text-sm text-muted">
          Não conseguimos carregar esta página agora. Tente novamente em instantes.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex items-center rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
