"use client";

import { useEffect, useState, type Dispatch } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { BLOCK_REGISTRY } from "@donation/blocks";
import { EDITOR_FIELDS } from "@/blocks/editor-fields";
import { cn } from "@/components/ui";
import { FieldInput } from "./FieldInput";
import { BlockIcon } from "./block-icons";
import { PageSettingsPanel } from "./PageSettingsPanel";
import { ThemePanel } from "./ThemePanel";
import { blockIssues } from "./block-status";
import { PALETTE } from "./palette-config";
import type { EditorBlock, StudioAction } from "./studio-reducer";
import type { Theme } from "./Studio";

type Tab = "block" | "page" | "theme";

const HINT_BY_TYPE = Object.fromEntries(
  PALETTE.flatMap((g) => g.items.map((it) => [it.type, it.hint])),
) as Record<string, string>;

export function Inspector({
  orgId,
  campaignId,
  campaignSlug,
  seo,
  theme,
  onThemeChange,
  selected,
  dispatch,
}: {
  orgId: string;
  campaignId: string;
  campaignSlug: string;
  seo: { title: string; description: string };
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  selected: EditorBlock | null;
  dispatch: Dispatch<StudioAction>;
}) {
  const [tab, setTab] = useState<Tab>("block");

  useEffect(() => {
    if (selected) setTab("block");
  }, [selected?.id]);

  return (
    <div className="flex h-full flex-col border-l border-line-strong bg-surface">
      <div role="tablist" aria-label="Inspetor" className="flex gap-1 border-b border-line p-2">
        {(
          [
            ["block", "Bloco"],
            ["page", "Página"],
            ["theme", "Tema"],
          ] as [Tab, string][]
        ).map(([t, lbl]) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-[0.8125rem] font-medium transition-colors",
              tab === t ? "bg-canvas text-ink" : "text-muted hover:text-ink",
            )}
          >
            {lbl}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "block" &&
          (selected ? (
            <BlockPanel key={selected.id} block={selected} dispatch={dispatch} />
          ) : (
            <p className="mt-6 text-center text-sm text-muted">
              Selecione um bloco no canvas para editar suas propriedades.
            </p>
          ))}
        {tab === "page" && (
          <PageSettingsPanel orgId={orgId} campaignId={campaignId} campaignSlug={campaignSlug} seo={seo} />
        )}
        {tab === "theme" && <ThemePanel theme={theme} onChange={onThemeChange} />}
      </div>
    </div>
  );
}

function BlockPanel({ block, dispatch }: { block: EditorBlock; dispatch: Dispatch<StudioAction> }) {
  const fields = EDITOR_FIELDS[block.type];
  const issues = blockIssues(block);

  // Live per-field validation against the block's Zod schema.
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (f.required) {
      const v = (block.props as Record<string, unknown>)[f.key];
      if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) errors[f.key] = "Obrigatório";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-canvas text-muted">
          <BlockIcon type={block.type} className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{BLOCK_REGISTRY[block.type].label}</div>
          <div className="text-xs text-muted">{HINT_BY_TYPE[block.type]}</div>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-warn-bg px-3 py-2.5 text-xs text-warn">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Falta preencher: <strong>{issues.join(", ")}</strong>. O bloco não aparece na página até isso ser
            resolvido.
          </span>
        </div>
      )}

      {fields.length === 0 ? (
        <p className="text-sm text-muted">Este bloco não tem configurações — o conteúdo vem da campanha.</p>
      ) : (
        <div className="space-y-3.5">
          {fields.map((f) => (
            <FieldInput
              key={f.key}
              field={f}
              value={block.props[f.key]}
              error={errors[f.key]}
              onChange={(v) => dispatch({ type: "patchProps", id: block.id, patch: { [f.key]: v } })}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => dispatch({ type: "remove", id: block.id })}
        className="flex items-center gap-1.5 text-xs font-medium text-danger hover:underline"
      >
        <Trash2 className="size-3.5" /> Remover bloco
      </button>
    </div>
  );
}
