"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { cn } from "./cn";

interface ConfirmOpts {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

/**
 * Promise-based replacement for `window.confirm` — accessible (native
 * `<dialog>`, focus trap, Esc), stylable, and lets the message carry context.
 *
 *   const { confirm, dialog } = useConfirm();
 *   ...
 *   if (await confirm({ title: "Remover?", tone: "danger" })) doIt();
 *   ...
 *   return (<>{children}{dialog}</>);
 */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback(
    (o: ConfirmOpts) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOpts(o);
      }),
    [],
  );

  const close = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  }, []);

  const dialog = opts ? <AlertDialogView {...opts} onClose={close} /> : null;
  return { confirm, dialog };
}

function AlertDialogView({
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  onClose,
}: ConfirmOpts & { onClose: (v: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose(false);
    };
    el?.addEventListener("cancel", onCancel);
    return () => el?.removeEventListener("cancel", onCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className={cn(
        "m-auto w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-line bg-surface p-5 text-ink shadow-pop",
        "backdrop:bg-black/40 backdrop:backdrop-blur-[1px]",
      )}
      onClick={(e) => {
        if (e.target === ref.current) onClose(false);
      }}
    >
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {description && <div className="mt-1.5 text-sm text-muted">{description}</div>}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => onClose(false)}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={tone === "danger" ? "danger" : "primary"}
          size="sm"
          onClick={() => onClose(true)}
          autoFocus
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
