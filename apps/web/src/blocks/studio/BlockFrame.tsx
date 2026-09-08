"use client";

import { Component, memo, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ArrowUp, ArrowDown, Copy, Trash2, TriangleAlert } from "lucide-react";
import { BLOCK_REGISTRY } from "@donation/blocks";
import { cn } from "@/components/ui";
import { CanvasBlock } from "./CanvasBlock";
import { isBlockIncomplete } from "./block-status";
import type { StaticCtx } from "@/blocks/render-static";
import type { EditorBlock } from "./studio-reducer";

class BlockErrorBoundary extends Component<{ label: string; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto my-4 flex max-w-2xl items-center gap-2 rounded-xl border border-dashed border-danger/40 bg-danger-bg px-5 py-4 text-sm text-danger">
        <TriangleAlert className="size-4 shrink-0" />
        Não foi possível pré-visualizar “{this.props.label}”. Ele ainda aparece na página publicada.
      </div>
    );
  }
}

function BlockFrameImpl({
  block,
  index,
  total,
  selected,
  ctx,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
}: {
  block: EditorBlock;
  index: number;
  total: number;
  selected: boolean;
  ctx: StaticCtx;
  onSelect: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: block.id,
  });
  const label = BLOCK_REGISTRY[block.type].label;
  const incomplete = isBlockIncomplete(block);
  const iconBtn =
    "grid size-8 place-items-center rounded text-white/90 transition-colors hover:bg-white/15 focus-visible:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:opacity-40";
  const chromeVis = cn(
    "transition-opacity",
    selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative", isDragging && "opacity-50")}
    >
      {isOver && !isDragging && <div className="absolute -top-1 inset-x-0 z-30 h-0.5 rounded bg-brand-500" />}

      <div
        className={cn(
          "relative transition-shadow",
          selected ? "ring-2 ring-brand-500 ring-inset" : "ring-1 ring-transparent ring-inset hover:ring-brand-200",
        )}
      >
        {/* label */}
        <span
          className={cn(
            "pointer-events-none absolute -top-3 left-3 z-30 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium text-white",
            incomplete ? "bg-warn" : "bg-ink",
            chromeVis,
          )}
        >
          {incomplete && <span className="size-1.5 rounded-full bg-white" />}
          {label}
          {incomplete && <span className="opacity-90">· incompleto</span>}
        </span>

        {/* toolbar */}
        <div
          className={cn(
            "absolute -top-3.5 right-3 z-30 flex items-center gap-1 rounded-md bg-ink px-1 py-1",
            chromeVis,
          )}
        >
          <button
            type="button"
            aria-label={`Arrastar “${label}” para reordenar`}
            title="Arrastar para reordenar"
            className={cn(iconBtn, "cursor-grab active:cursor-grabbing")}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Mover para cima"
            title="Mover para cima"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className={iconBtn}
          >
            <ArrowUp className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Mover para baixo"
            title="Mover para baixo"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className={iconBtn}
          >
            <ArrowDown className="size-3.5" />
          </button>
          <span className="mx-0.5 h-4 w-px bg-white/20" />
          <button
            type="button"
            aria-label="Duplicar bloco"
            title="Duplicar (⌘D)"
            onClick={onDuplicate}
            className={iconBtn}
          >
            <Copy className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Remover bloco"
            title="Remover (Delete)"
            onClick={onRemove}
            className={cn(iconBtn, "hover:bg-danger focus-visible:bg-danger")}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>

        {/* preview — inert; the transparent layer below owns selection */}
        <div className="pointer-events-none">
          <BlockErrorBoundary label={label}>
            <CanvasBlock block={block} ctx={ctx} />
          </BlockErrorBoundary>
        </div>

        <button
          type="button"
          aria-label={`Selecionar bloco ${label}`}
          aria-pressed={selected}
          onClick={onSelect}
          className="absolute inset-0 z-20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 focus-visible:outline-none"
        />
      </div>
    </div>
  );
}

export const BlockFrame = memo(BlockFrameImpl);
