"use client";

import { useActionState, useEffect, useMemo, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Copy, Trash2, Undo2, Redo2 } from "lucide-react";
import {
  EMAIL_BLOCK_DEFS,
  EMAIL_BLOCK_TYPES,
  renderEmailBlocks,
  type EmailBlock,
  type EmailBlockType,
} from "@donation/emails/blocks";
import { Field, Input, Button, cn } from "@/components/ui";
import { resetEmailTemplate, updateEmailTemplate } from "@/server/crm/email-templates";
import { builderReducer, initBuilder, resolveReorder } from "./email-builder-reducer";
import { BlockInspector } from "./BlockInspector";
import { TestSendBox } from "./TestSendBox";

interface TemplateVar {
  token: string;
  label: string;
}

function fillTokens(text: string, vars: Record<string, string>) {
  return text.replace(/\{([A-Z_]+)\}/g, (m, k: string) => (vars[k] != null ? vars[k]! : m));
}

// Mirrors packages/emails SHELL — kept in sync so the in-app preview matches the real send.
function previewDoc(blocks: EmailBlock[], vars: Record<string, string>, logoUrl: string | null) {
  const inner = renderEmailBlocks(blocks);
  const logo = logoUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:0 0 22px"><img src="${logoUrl}" alt="" height="44" style="height:44px;width:auto;border:0;display:block"></td></tr></table>`
    : "";
  const shell = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#2f3b37">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5">
      <tr><td align="center" style="padding:28px 12px">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px">
          <tr><td bgcolor="#ffffff" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:34px 32px;font-size:15px;line-height:1.6">${logo}${inner}</td></tr>
          <tr><td style="padding:16px 8px 0;text-align:center;font-size:12px;color:#9ca3af">Enviado por ${vars.ORGANIZACAO ?? ""}.</td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
  return fillTokens(shell, vars);
}

function summarize(b: EmailBlock): string {
  const p = b.props as Record<string, unknown>;
  const strip = (s: unknown) => String(s ?? "").replace(/<[^>]+>/g, "").trim();
  switch (b.type) {
    case "heading":
    case "footer":
      return strip(p.text) || "—";
    case "text":
    case "callout":
    case "html":
      return strip(p.html).slice(0, 60) || "—";
    case "button":
      return `${strip(p.label)} → ${strip(p.href)}`;
    case "image":
      return p.src ? "imagem definida" : "sem imagem";
    case "divider":
      return "linha";
    case "spacer":
      return `${p.height}px`;
    case "donationDetails":
      return (Array.isArray(p.fields) ? p.fields : []).join(", ") || "—";
    default:
      return "";
  }
}

export function EmailBuilder({
  orgId,
  kind,
  subject: subject0,
  blocks: blocks0,
  vars,
  sample,
  logoUrl,
  customized,
}: {
  orgId: string;
  kind: string;
  subject: string;
  blocks: EmailBlock[];
  vars: TemplateVar[];
  sample: Record<string, string>;
  logoUrl: string | null;
  customized: boolean;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(builderReducer, blocks0, initBuilder);
  const [subject, setSubject] = useState(subject0);
  const [copied, setCopied] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [saveState, action, pending] = useActionState(updateEmailTemplate.bind(null, orgId, kind), null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (saveState?.ok) router.refresh();
  }, [saveState, router]);

  const doc = useMemo(() => previewDoc(state.blocks, sample, logoUrl), [state.blocks, sample, logoUrl]);
  const blocksJson = useMemo(() => JSON.stringify(state.blocks), [state.blocks]);

  const onDragEnd = (e: DragEndEvent) => {
    const a = resolveReorder(state.blocks, String(e.active.id), e.over ? String(e.over.id) : null);
    if (a) dispatch(a);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="min-w-0 space-y-4">
      <form action={action} className="space-y-4">
        {!customized && (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
            Este é o modelo padrão da plataforma. Ao salvar, ele vira o modelo da sua organização.
          </p>
        )}

        <Field label="Assunto" hint="A primeira linha que aparece na caixa de entrada.">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} required />
        </Field>

        {/* variable chips */}
        <div className="flex flex-wrap gap-1.5">
          {vars.map((v) => (
            <button
              key={v.token}
              type="button"
              title={v.label}
              onClick={() => {
                navigator.clipboard.writeText(v.token).catch(() => {});
                setCopied(v.token);
                setTimeout(() => setCopied(null), 1200);
              }}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono text-[0.7rem]",
                copied === v.token
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-line-strong text-muted hover:border-muted/40 hover:text-ink",
              )}
            >
              {v.token}
            </button>
          ))}
        </div>

        {/* palette */}
        <div className="rounded-lg border border-line p-2">
          <div className="mb-1.5 px-1 text-xs font-medium text-muted">Adicionar bloco</div>
          <div className="flex flex-wrap gap-1.5">
            {EMAIL_BLOCK_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => dispatch({ type: "insert", blockType: t as EmailBlockType })}
                className="inline-flex items-center gap-1 rounded-md border border-line-strong px-2 py-1 text-xs text-muted hover:border-brand-600 hover:text-brand-700"
              >
                <Plus className="size-3" /> {EMAIL_BLOCK_DEFS[t].label}
              </button>
            ))}
          </div>
        </div>

        {/* history */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={state.past.length === 0}
            onClick={() => dispatch({ type: "undo" })}
            className="grid size-8 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink disabled:opacity-30"
            aria-label="Desfazer"
          >
            <Undo2 className="size-4" />
          </button>
          <button
            type="button"
            disabled={state.future.length === 0}
            onClick={() => dispatch({ type: "redo" })}
            className="grid size-8 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink disabled:opacity-30"
            aria-label="Refazer"
          >
            <Redo2 className="size-4" />
          </button>
        </div>

        {/* block list */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={state.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {state.blocks.map((b) => (
                <BlockRow
                  key={b.id}
                  orgId={orgId}
                  block={b}
                  selected={state.selectedId === b.id}
                  onSelect={() => dispatch({ type: "select", id: state.selectedId === b.id ? null : b.id })}
                  onPatch={(patch) => dispatch({ type: "patch", id: b.id, patch })}
                  onDuplicate={() => dispatch({ type: "duplicate", id: b.id })}
                  onRemove={() => dispatch({ type: "remove", id: b.id })}
                />
              ))}
              {state.blocks.length === 0 && (
                <li className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
                  Adicione um bloco acima para começar.
                </li>
              )}
            </ul>
          </SortableContext>
        </DndContext>

        <input type="hidden" name="subject" value={subject} />
        <input type="hidden" name="blocksJson" value={blocksJson} />

        {saveState?.error && <p className="field-error">{saveState.error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={pending || state.blocks.length === 0}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
          {customized && (
            <button
              type="button"
              disabled={resetting}
              onClick={async () => {
                if (!confirm("Voltar ao modelo padrão da plataforma?")) return;
                setResetting(true);
                await resetEmailTemplate(orgId, kind);
                router.refresh();
              }}
              className="text-sm text-muted hover:text-danger"
            >
              Voltar ao padrão
            </button>
          )}
        </div>
      </form>

      <TestSendBox orgId={orgId} kind={kind} subject={subject} blocksJson={blocksJson} />
      </div>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="mb-1.5 text-xs font-medium text-muted">Prévia (com dados de exemplo)</div>
        <iframe
          title="Prévia do e-mail"
          srcDoc={doc}
          className="h-[36rem] w-full rounded-xl border border-line bg-white"
        />
      </div>
    </div>
  );
}

function BlockRow({
  orgId,
  block,
  selected,
  onSelect,
  onPatch,
  onDuplicate,
  onRemove,
}: {
  orgId: string;
  block: EmailBlock;
  selected: boolean;
  onSelect: () => void;
  onPatch: (patch: Record<string, unknown>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "overflow-hidden rounded-lg border bg-surface",
        selected ? "border-brand-600" : "border-line",
        isDragging && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <button
          type="button"
          className="cursor-grab touch-none text-faint hover:text-muted"
          aria-label="Arrastar"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="text-sm font-medium">{EMAIL_BLOCK_DEFS[block.type].label}</div>
          <div className="truncate text-xs text-muted">{summarize(block)}</div>
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          aria-label="Duplicar"
          className="grid size-7 place-items-center rounded text-muted hover:bg-canvas hover:text-ink"
        >
          <Copy className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remover"
          className="grid size-7 place-items-center rounded text-muted hover:bg-canvas hover:text-danger"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {selected && <BlockInspector orgId={orgId} block={block} onPatch={onPatch} />}
    </li>
  );
}
