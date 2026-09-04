"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { cn } from "@/components/ui";

export interface RowAction {
  label: string;
  href: string;
  external?: boolean;
  danger?: boolean;
}

const MENU_W = 180;

/**
 * Trailing "⋮" actions menu for table rows. Positioned `fixed` from the trigger's
 * rect so it isn't clipped by the table's `overflow-x-auto` wrapper.
 */
export function RowMenu({ actions, label = "Ações da linha" }: { actions: RowAction[]; label?: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: Math.max(8, r.right - MENU_W) });
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? setPos(null) : place())}
        className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-ink"
      >
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: MENU_W }}
          className="z-50 rounded-lg border border-line bg-surface p-1 text-sm shadow-card"
        >
          {actions.map((a) => (
            <Link
              key={a.label}
              role="menuitem"
              href={a.href}
              target={a.external ? "_blank" : undefined}
              onClick={() => setPos(null)}
              className={cn(
                "block truncate rounded-md px-2.5 py-1.5 no-underline hover:bg-canvas",
                a.danger ? "text-danger" : "text-ink",
              )}
            >
              {a.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
