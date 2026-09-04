"use client";

import type { EmailBlock } from "@donation/emails/blocks";
import { Field, Input, Textarea, Select, cn } from "@/components/ui";
import { BLOCK_FIELDS, DETAIL_FIELD_OPTIONS, type FieldDef } from "./field-defs";
import { ImageField } from "./ImageField";

export function BlockInspector({
  orgId,
  block,
  onPatch,
}: {
  orgId: string;
  block: EmailBlock;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const fields = BLOCK_FIELDS[block.type] ?? [];
  return (
    <div className="space-y-3 border-t border-line bg-canvas/60 p-3">
      {fields.map((f) => (
        <FieldControl key={f.name} orgId={orgId} field={f} value={block.props[f.name]} onPatch={onPatch} />
      ))}
    </div>
  );
}

function FieldControl({
  orgId,
  field,
  value,
  onPatch,
}: {
  orgId: string;
  field: FieldDef;
  value: unknown;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const set = (v: unknown) => onPatch({ [field.name]: v });

  switch (field.kind) {
    case "image":
      return <ImageField orgId={orgId} value={(value as string) ?? ""} onChange={set} />;

    case "text":
    case "url":
      return (
        <Field label={field.label} hint={field.hint}>
          <Input
            type={field.kind === "url" ? "url" : "text"}
            value={(value as string) ?? ""}
            onChange={(e) => set(e.target.value)}
          />
        </Field>
      );

    case "line":
    case "rich":
      return (
        <Field label={field.label} hint={field.hint}>
          <RichText value={(value as string) ?? ""} rows={field.kind === "rich" ? 4 : 2} onChange={set} />
        </Field>
      );

    case "number":
      return (
        <Field label={field.label} hint={field.hint}>
          <Input
            type="number"
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) => set(e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </Field>
      );

    case "color":
      return (
        <Field label={field.label} hint={field.hint}>
          <span className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test((value as string) ?? "") ? (value as string) : "#006b4f"}
              onChange={(e) => set(e.target.value)}
              className="size-9 shrink-0 cursor-pointer rounded-md border border-line-strong bg-surface"
            />
            <Input value={(value as string) ?? ""} placeholder="#006b4f" onChange={(e) => set(e.target.value)} />
          </span>
        </Field>
      );

    case "select":
      return (
        <Field label={field.label} hint={field.hint}>
          <Select value={(value as string) ?? field.options?.[0]?.value} onChange={(e) => set(e.target.value)}>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      );

    case "detailFields": {
      const current = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="grid gap-1.5">
          <span className="label">{field.label}</span>
          {DETAIL_FIELD_OPTIONS.map((o) => {
            const on = current.includes(o.value);
            return (
              <label key={o.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    set(on ? current.filter((v) => v !== o.value) : [...current, o.value])
                  }
                />
                {o.label}
              </label>
            );
          })}
          {field.hint && <span className="hint">{field.hint}</span>}
        </div>
      );
    }

    default:
      return null;
  }
}

/** Textarea + a tiny formatting toolbar that wraps the selection in a tag. */
function RichText({
  value,
  rows,
  onChange,
}: {
  value: string;
  rows: number;
  onChange: (v: string) => void;
}) {
  const wrap = (el: HTMLTextAreaElement, before: string, after: string) => {
    const { selectionStart: s, selectionEnd: e } = el;
    const next = value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e);
    onChange(next);
  };
  return (
    <div>
      <div className="mb-1 flex gap-1">
        {(
          [
            ["B", "<strong>", "</strong>"],
            ["I", "<em>", "</em>"],
            ["Link", '<a href="{LINK}">', "</a>"],
          ] as const
        ).map(([label, b, a]) => (
          <button
            key={label}
            type="button"
            onMouseDown={(ev) => {
              ev.preventDefault();
              const ta = (ev.currentTarget.parentElement?.nextElementSibling as HTMLTextAreaElement) ?? null;
              if (ta) wrap(ta, b, a);
            }}
            className={cn(
              "rounded border border-line-strong px-2 py-0.5 text-xs text-muted hover:text-ink",
              label === "B" && "font-bold",
              label === "I" && "italic",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
    </div>
  );
}
