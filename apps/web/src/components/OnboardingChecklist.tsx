"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X, ArrowRight } from "lucide-react";
import type { OnboardingStep } from "@/server/onboarding/checklist";
import { cn } from "@/components/ui";

function Ring({ pct }: { pct: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 48 48" className="size-12 shrink-0 -rotate-90" aria-hidden>
      <circle cx="24" cy="24" r={r} fill="none" stroke="var(--color-line-strong)" strokeWidth="4" />
      <circle
        cx="24"
        cy="24"
        r={r}
        fill="none"
        stroke="var(--color-brand-500)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
      />
    </svg>
  );
}

export function OnboardingChecklist({ steps, orgId }: { steps: OnboardingStep[]; orgId: string }) {
  const key = `onboarding-dismissed:${orgId}`;
  const [dismissed, setDismissed] = useState(true); // hidden until we've checked storage (avoids flash)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(key) === "1");
    } catch {
      setDismissed(false);
    }
  }, [key]);

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const next = steps.find((s) => !s.done);

  if (dismissed || !next) return null; // fully complete → nothing to nudge

  const dismiss = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <section className="card p-5" aria-labelledby="onboarding-title">
      <div className="flex items-start gap-4">
        <Ring pct={pct} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="onboarding-title" className="text-sm font-semibold">
              Primeiros passos
            </h2>
            <span className="badge-neutral">Montando a operação</span>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {doneCount} de {steps.length} concluídos
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar checklist"
          className="grid size-7 shrink-0 place-items-center rounded-md text-faint transition-colors hover:bg-canvas hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4 rounded-lg bg-canvas p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow">Próximo passo</div>
            <div className="mt-0.5 text-sm font-medium">{next.label}</div>
            <p className="mt-0.5 text-xs text-muted">{next.description}</p>
          </div>
          <Link href={next.href} className="btn-primary btn-sm no-underline">
            Completar <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-2">
        {steps.map((s) => {
          const isNext = s.id === next.id;
          return (
            <li key={s.id}>
              <Link
                href={s.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  s.done && "border-line bg-canvas text-muted",
                  isNext && "border-brand-300 bg-brand-50 font-medium text-brand-700",
                  !s.done && !isNext && "border-line-strong text-muted hover:border-muted/40 hover:text-ink",
                )}
              >
                {s.done && <Check className="size-3 text-success" />}
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
