import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * A titled group of fields inside a form. Gives long panel forms a scannable
 * structure instead of one flat column of inputs.
 */
export function FormSection({
  title,
  description,
  aside,
  className,
  children,
}: {
  title: string;
  description?: string;
  /** Right-aligned control in the header row (e.g. an "add" button). */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("border-t border-line pt-5 first:border-t-0 first:pt-0", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {aside}
      </div>
      <div className="mt-3 grid gap-3">{children}</div>
    </section>
  );
}

/** Sticky action bar for the bottom of a form (save / cancel). */
export function FormActions({
  children,
  className,
  dirty,
}: {
  children: ReactNode;
  className?: string;
  /** When set, the bar only sticks (and highlights) while there are unsaved changes. */
  dirty?: boolean;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-2 border-t bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6",
        dirty === false ? "border-transparent" : "border-line",
        className,
      )}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {children}
    </div>
  );
}
