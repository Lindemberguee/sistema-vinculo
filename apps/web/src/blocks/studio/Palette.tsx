"use client";

import { useMemo, useState, type Dispatch, type RefObject } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Search, GripVertical } from "lucide-react";
import { BLOCK_REGISTRY, type BlockType } from "@donation/blocks";
import { cn } from "@/components/ui";
import { BlockIcon } from "./block-icons";
import { PALETTE } from "./palette-config";
import type { StudioAction } from "./studio-reducer";

export function Palette({
  dispatch,
  searchRef,
}: {
  dispatch: Dispatch<StudioAction>;
  searchRef?: RefObject<HTMLInputElement | null>;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const groups = useMemo(() => {
    if (!query) return PALETTE;
    return PALETTE.map((g) => ({
      ...g,
      items: g.items.filter(
        (it) => BLOCK_REGISTRY[it.type].label.toLowerCase().includes(query) || it.hint.toLowerCase().includes(query),
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <section aria-label="Biblioteca de blocos" className="flex h-full flex-col border-r border-line-strong bg-surface">
      <div className="border-b border-line p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar bloco"
            aria-label="Buscar bloco"
            className="input py-1.5 pl-8 text-[0.8125rem]"
          />
        </div>
        <p className="mt-1.5 px-0.5 text-[0.6875rem] text-faint">Clique para inserir ou arraste para o canvas.</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {groups.length === 0 && <p className="px-1 text-xs text-muted">Nenhum bloco encontrado.</p>}
        {groups.map((g) => (
          <div key={g.heading} className="mb-4 last:mb-0">
            <h2 className="eyebrow px-1 pb-1.5">{g.heading}</h2>
            <div className="grid gap-1">
              {g.items.map((it) => (
                <PaletteItem
                  key={it.type}
                  type={it.type}
                  hint={it.hint}
                  onInsert={() => dispatch({ type: "insert", blockType: it.type })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PaletteItem({ type, hint, onInsert }: { type: BlockType; hint: string; onInsert: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { from: "palette", blockType: type },
  });
  const label = BLOCK_REGISTRY[type].label;

  return (
    <div
      className={cn(
        "flex items-stretch rounded-lg border border-transparent transition-colors hover:border-line-strong hover:bg-canvas",
        isDragging && "opacity-50",
      )}
    >
      <button
        ref={setNodeRef}
        type="button"
        aria-label={`Arrastar ${label} para o canvas`}
        title="Arrastar para o canvas"
        className="grid min-h-10 w-9 shrink-0 cursor-grab place-items-center rounded-l-lg text-faint hover:text-muted active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 focus-visible:text-brand-600"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onInsert}
        className="flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-r-lg py-1.5 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-canvas text-muted">
          <BlockIcon type={type} className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-[0.8125rem] font-medium">{label}</span>
          <span className="line-clamp-2 text-[0.6875rem] leading-snug text-muted">{hint}</span>
        </span>
      </button>
    </div>
  );
}
