import type { ReactNode } from "react";
import { Check, HeartHandshake } from "lucide-react";

const POINTS = [
  "Campanhas, checkout e recibos em um só lugar",
  "Sua conta Pagar.me — o repasse é direto",
  "CRM de doadores e comunicação incluídos",
];

/** Split frame for the sign-in / register / reset / invite pages. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-canvas lg:grid lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-brand-900 px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="relative flex items-center gap-2.5 font-semibold">
          <span className="grid size-8 place-items-center rounded-xl bg-white/10">
            <HeartHandshake className="size-4" aria-hidden />
          </span>
          Plataforma de Doações
        </div>
        <div className="relative">
          <p className="text-2xl font-semibold leading-snug tracking-[-0.02em]">
            Mais tempo para a causa. Mais clareza para captar.
          </p>
          <ul className="mt-6 grid gap-3 text-sm text-white/75">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-brand-200" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/45">Feito para o terceiro setor brasileiro.</p>
      </aside>

      <div className="flex min-h-screen flex-col justify-center px-5 py-12 sm:px-8 lg:min-h-0">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2 text-sm font-semibold lg:hidden">
            <span className="grid size-7 place-items-center rounded-lg bg-brand-600 text-white">
              <HeartHandshake className="size-4" aria-hidden />
            </span>
            Plataforma de Doações
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          {children}
        </div>
      </div>
    </main>
  );
}
