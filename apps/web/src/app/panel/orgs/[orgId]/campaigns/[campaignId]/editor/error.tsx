"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function EditorError({
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
    <div className="fixed inset-0 z-40 grid place-items-center bg-canvas px-6">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-8 text-center">
        <p className="text-3xl">⚠️</p>
        <h1 className="mt-3 text-lg font-semibold">Não foi possível abrir o editor</h1>
        <p className="mt-1 text-sm text-muted">Tente novamente ou volte para a campanha.</p>
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" onClick={reset} className="btn-primary btn-sm">
            Tentar de novo
          </button>
          <Link href=".." className="btn-secondary btn-sm no-underline">
            Voltar
          </Link>
        </div>
      </div>
    </div>
  );
}
