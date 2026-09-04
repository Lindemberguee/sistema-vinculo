import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "icon";

const variantClass: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const sizeClass = (s: Size) => (s === "sm" ? "btn-sm" : s === "icon" ? "btn-icon" : undefined);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner, disables the button, sets aria-busy. */
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(variantClass[variant], sizeClass(size), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: Variant;
  size?: Size;
}

export function LinkButton({ href, variant = "primary", size = "md", className, ...props }: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={cn(variantClass[variant], sizeClass(size), "no-underline", className)}
      {...props}
    />
  );
}
