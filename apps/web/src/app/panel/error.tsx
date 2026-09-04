"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";

export default function PanelError({
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
    <main className="grid min-h-screen place-items-center bg-canvas px-6 py-12">
      <section className="card w-full max-w-md p-8 text-center" role="alert">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-danger-bg text-danger">
          <AlertTriangle className="size-5" aria-hidden />
        </span>
        <h1 className="mt-4 text-heading">Não foi possível carregar o painel</h1>
        <p className="mt-2 text-sm text-muted">
          Ocorreu um erro inesperado. Tente novamente; se continuar, volte ao início e avise o suporte.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={reset}>
            Tentar novamente
          </Button>
          <Link href="/panel" className="btn-secondary no-underline">
            Voltar ao início
          </Link>
        </div>
      </section>
    </main>
  );
}
