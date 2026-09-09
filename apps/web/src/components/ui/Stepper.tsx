import { Check } from "lucide-react";
import { cn } from "./cn";

/**
 * Horizontal progress stepper. `current` is 1-based; steps before it render as
 * completed (check), the current one is filled, the rest are muted.
 */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center" aria-label={`Etapa ${current} de ${steps.length}`}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className={cn("flex items-center", i < steps.length - 1 && "flex-1")}>
            <div className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors",
                  done && "border-brand-600 bg-brand-600 text-white",
                  active && "border-brand-600 text-brand-700",
                  !done && !active && "border-line-strong text-faint",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : n}
              </span>
              <span
                className={cn(
                  "hidden text-sm sm:inline",
                  active ? "font-medium text-ink" : "text-muted",
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                className={cn("mx-2 h-px flex-1 sm:mx-3", done ? "bg-brand-400" : "bg-line-strong")}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
