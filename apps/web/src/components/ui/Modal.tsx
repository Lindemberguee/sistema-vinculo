"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

const SIZE = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

/**
 * Centered modal on a native <dialog> — focus trap, Esc-to-close and inert
 * background come for free. Backdrop click closes. Mount it wherever; it only
 * shows while `open`.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  size?: keyof typeof SIZE;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop",
        "backdrop:bg-black/40 backdrop:backdrop-blur-[1px]",
        SIZE[size],
      )}
      aria-labelledby="modal-title"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
        <div className="min-w-0">
          <h2 id="modal-title" className="text-base font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="-mr-1 grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="max-h-[calc(100vh-10rem)] overflow-y-auto px-5 py-4">{children}</div>
    </dialog>
  );
}
