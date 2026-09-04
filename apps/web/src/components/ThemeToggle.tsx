"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Panel-only light/dark toggle. Persists in a `theme` cookie (read server-side
 * by `panel/layout.tsx`) and flips `#panel-root[data-theme]` for instant effect.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.getElementById("panel-root")?.dataset.theme === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const root = document.getElementById("panel-root");
    if (root) {
      if (next) root.dataset.theme = "dark";
      else delete root.dataset.theme;
    }
    document.cookie = `theme=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
      title={dark ? "Tema claro" : "Tema escuro"}
      className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
