import { cloneElement, isValidElement, useId, type ReactElement } from "react";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export function Field({
  label,
  hint,
  error,
  success,
  required,
  optional,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  /** Positive confirmation under the field (e.g. "Domínio verificado"). */
  success?: string;
  /** Adds a red asterisk after the label. */
  required?: boolean;
  /** Adds a muted "(opcional)" after the label. */
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : success ? `${id}-success` : hint ? `${id}-hint` : undefined;

  // When the control is a single element (Input/Select/Textarea/…), wire up
  // aria-invalid + aria-describedby automatically instead of asking every
  // call site to repeat it.
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })
    : children;

  return (
    <label
      className={cn("grid gap-1.5", className)}
      data-invalid={error ? "" : undefined}
      data-success={success && !error ? "" : undefined}
    >
      <span className="label">
        {label}
        {required && (
          <span className="text-danger" aria-hidden>
            {" "}
            *
          </span>
        )}
        {optional && <span className="ml-1 font-normal text-faint">(opcional)</span>}
      </span>
      {control}
      {hint && !error && !success && (
        <span id={`${id}-hint`} className="hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="field-error" role="alert">
          {error}
        </span>
      )}
      {success && !error && (
        <span id={`${id}-success`} className="text-xs text-success">
          {success}
        </span>
      )}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("input", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("input", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("input", className)} {...props} />;
}

export function Checkbox({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn("flex items-center gap-2 text-sm", className)}>
      <input type="checkbox" className="size-4 accent-brand-600" {...props} />
      {label}
    </label>
  );
}
