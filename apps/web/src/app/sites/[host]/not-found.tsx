import Link from "next/link";
import { SearchX } from "lucide-react";

export default function SiteNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-5">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-line bg-surface text-muted shadow-card">
          <SearchX className="size-5" aria-hidden />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight">Página não encontrada</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          O link pode estar incorreto ou a campanha não está mais no ar.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex min-h-11 items-center rounded-full border border-line-strong px-4 text-sm font-medium hover:bg-surface"
        >
          Ver campanhas da organização
        </Link>
      </div>
    </div>
  );
}
