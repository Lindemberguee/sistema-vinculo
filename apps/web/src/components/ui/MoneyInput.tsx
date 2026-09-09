"use client";

import { useId, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

const fmt = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);

/**
 * BRL money input. Renders an `R$` adornment and keeps the value as integer
 * cents. Also emits a hidden `<input name>` with the raw cents so it drops into
 * a plain `<form action>` unchanged.
 */
export function MoneyInput({
  valueCents,
  onValueChange,
  name,
  className,
  disabled,
  placeholder = "0,00",
  ...rest
}: {
  valueCents: number;
  onValueChange: (cents: number) => void;
  name?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "name">) {
  const id = useId();
  return (
    <div
      className={cn(
        "flex items-center rounded-md border border-line-strong bg-surface transition-[border-color,box-shadow] duration-150 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15",
        disabled && "opacity-70",
        className,
      )}
    >
      <span className="pl-3 text-sm font-medium text-muted" aria-hidden>
        R$
      </span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={valueCents > 0 ? fmt(valueCents) : ""}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
          onValueChange(digits ? parseInt(digits, 10) : 0);
        }}
        className="min-h-11 w-full bg-transparent px-2 text-sm tabular-nums text-ink placeholder:text-faint focus:outline-none disabled:cursor-not-allowed"
        {...rest}
      />
      {name && <input type="hidden" name={name} value={valueCents || ""} />}
    </div>
  );
}
