"use client";

import { useCallback, type Dispatch } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { newBlock } from "@donation/blocks";
import { cn } from "@/components/ui";
import type { StaticCtx } from "@/blocks/render-static";
import { BlockFrame } from "./BlockFrame";
import { STARTERS } from "./palette-config";
import type { EditorBlock, StudioAction, Device } from "./studio-reducer";

const DEVICE_WIDTH: Record<Device, string> = { desktop: "max-w-[900px]", mobile: "max-w-[390px]" };

export function Canvas({
  blocks,
  selectedId,
  device,
  dragging,
  ctx,
  dispatch,
  onAddClick,
}: {
  blocks: EditorBlock[];
  selectedId: string | null;
  device: Device;
  dragging: boolean;
  ctx: StaticCtx;
  dispatch: Dispatch<StudioAction>;
  onAddClick: () => void;
}) {
  const { setNodeRef: setEndRef, isOver: endIsOver } = useDroppable({ id: "canvas-end" });

  const select = useCallback((id: string) => dispatch({ type: "select", id }), [dispatch]);
  const move = useCallback((from: number, to: number) => dispatch({ type: "move", from, to }), [dispatch]);
  const duplicate = useCallback((id: string) => dispatch({ type: "duplicate", id }), [dispatch]);
  const remove = useCallback((id: string) => dispatch({ type: "remove", id }), [dispatch]);

  return (
    <div className="h-full overflow-y-auto bg-canvas p-3 sm:p-6" onClick={() => dispatch({ type: "select", id: null })}>
      <div
        className={cn(
          "@container mx-auto w-full rounded-lg border border-line bg-surface shadow-[0_1px_3px_rgb(20_24_22/0.06),0_8px_24px_-12px_rgb(20_24_22/0.12)] transition-[max-width]",
          DEVICE_WIDTH[device],
        )}
      >
        <div className="flex items-center justify-between border-b border-line bg-canvas/60 px-3 py-2 text-[0.6875rem] text-muted sm:px-4">
          <span className="font-medium">Prévia aproximada</span>
          <span>{device === "mobile" ? "Largura mobile · 390 px" : "Largura desktop · 900 px"}</span>
        </div>
        {blocks.length === 0 ? (
          <EmptyState dispatch={dispatch} />
        ) : (
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="py-1" onClick={(e) => e.stopPropagation()}>
              {blocks.map((block, i) => (
                <BlockFrame
                  key={block.id}
                  block={block}
                  index={i}
                  total={blocks.length}
                  selected={block.id === selectedId}
                  ctx={ctx}
                  onSelect={() => select(block.id)}
                  onMove={(dir) => move(i, i + dir)}
                  onDuplicate={() => duplicate(block.id)}
                  onRemove={() => remove(block.id)}
                />
              ))}

              <div ref={setEndRef} className="p-3">
                {dragging ? (
                  <div
                    className={cn(
                      "grid place-items-center rounded-lg border border-dashed py-6 text-xs transition-colors",
                      endIsOver ? "border-brand-400 bg-brand-50 text-brand-600" : "border-line-strong text-faint",
                    )}
                  >
                    Solte aqui para adicionar ao fim
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onAddClick}
                    className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-medium text-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                  >
                    <Plus className="size-3.5" /> Adicionar bloco
                  </button>
                )}
              </div>
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}

function EmptyState({ dispatch }: { dispatch: Dispatch<StudioAction> }) {
  return (
    <div className="px-4 py-10 sm:px-8 sm:py-12" onClick={(e) => e.stopPropagation()}>
      <div className="text-center">
        <h2 className="text-lg font-semibold tracking-tight">Comece por um modelo</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Cada modelo já vem com blocos e textos de exemplo. Ajuste tudo depois — ou monte do zero
          arrastando blocos da esquerda.
        </p>
      </div>
      <div className="mx-auto mt-7 grid max-w-2xl gap-2.5 @lg:grid-cols-2">
        {STARTERS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() =>
              dispatch({
                type: "reset",
                blocks: s.blocks.map((b) => {
                  const base = newBlock(b.type) as EditorBlock;
                  return b.props ? { ...base, props: { ...base.props, ...b.props } } : base;
                }),
                keepHistory: true,
              })
            }
            className="group flex flex-col rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-brand-400 hover:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{s.label}</span>
              <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-[0.6875rem] font-medium text-muted group-hover:bg-surface">
                {s.blocks.length} blocos
              </span>
            </div>
            <span className="mt-1 text-xs leading-relaxed text-muted">{s.goal}</span>
            <span className="mt-2 text-[0.6875rem] leading-relaxed text-faint">{s.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
