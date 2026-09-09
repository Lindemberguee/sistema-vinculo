"use client";

import { useId } from "react";
import { cn } from "./cn";

/**
 * Accessible on/off switch for boolean settings — replaces the plain
 * `<input type="checkbox">` scattered across the settings forms. Pass `label` /
 * `description` for the common "row" layout, or use it bare inside your own row.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  className,
  id: idProp,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const toggle = (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label ? undefined : "Alternar"}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
        checked ? "bg-brand-600" : "bg-line-strong",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className="size-4 rounded-full bg-white shadow-sm transition-transform"
        style={{ transform: checked ? "translateX(1rem)" : "translateX(0)" }}
      />
    </button>
  );

  if (!label) return <span className={className}>{toggle}</span>;

  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-[0.8125rem] font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </label>
      {toggle}
    </div>
  );
}
