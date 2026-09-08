"use client";

import { useRef, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Field, Input, Textarea, Select, Checkbox } from "@/components/ui";
import type { Field as FieldConfig } from "@/blocks/editor-fields";

/** One property control in the Inspector. Zod (in @donation/blocks) stays the
 * source of truth on save; `error` surfaces the live per-field message. */
export function FieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldConfig;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}) {
  const label = field.required ? `${field.label} *` : field.label;
  switch (field.kind) {
    case "text":
      return (
        <Field label={label} hint={field.hint} error={error}>
          <Input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );

    case "url":
      return (
        <Field label={label} hint={field.hint} error={error}>
          <Input
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
          />
          <Thumb url={(value as string) ?? ""} />
        </Field>
      );

    case "textarea":
      return (
        <Field label={label} hint={field.hint} error={error}>
          <Textarea rows={4} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );

    case "number":
      return (
        <Field label={label} hint={field.hint} error={error}>
          <Input
            type="number"
            step="any"
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </Field>
      );

    case "datetime":
      return (
        <Field label={label} hint={field.hint} error={error}>
          <Input
            type="datetime-local"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
          />
        </Field>
      );

    case "color":
      return (
        <Field label={label} hint={field.hint} error={error}>
          <span className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test((value as string) ?? "") ? (value as string) : "#006B4F"}
              onChange={(e) => onChange(e.target.value)}
              className="size-9 shrink-0 cursor-pointer rounded-md border border-line-strong bg-surface"
            />
            <Input
              value={(value as string) ?? ""}
              placeholder="#006B4F"
              onChange={(e) => onChange(e.target.value || undefined)}
            />
          </span>
        </Field>
      );

    case "checkbox":
      return <Checkbox label={label} checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;

    case "select":
      return (
        <Field label={label} hint={field.hint} error={error}>
          <Select value={(value as string) ?? field.options[0]?.value} onChange={(e) => onChange(e.target.value)}>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      );

    case "multiSelect":
      return (
        <fieldset className="grid gap-2">
          <legend className="label">{label}</legend>
          {field.hint && <p className="hint">{field.hint}</p>}
          <div className="grid gap-1.5 rounded-lg border border-line p-2.5">
            {field.options.map((option) => {
              const values = Array.isArray(value) ? (value as unknown[]).map(String) : [];
              return (
                <label
                  key={option.value}
                  className="flex min-h-10 items-center gap-2 rounded-md px-1 text-sm hover:bg-canvas"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-brand-600"
                    checked={values.includes(option.value)}
                    onChange={(event) =>
                      onChange(
                        event.target.checked ? [...values, option.value] : values.filter((v) => v !== option.value),
                      )
                    }
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
          {error && (
            <span className="field-error" role="alert">
              {error}
            </span>
          )}
        </fieldset>
      );

    case "numberList":
      return (
        <RawTextField
          label={label}
          hint={field.hint ?? "Números inteiros separados por vírgula."}
          error={error}
          serialize={(arr) => (Array.isArray(arr) ? (arr as number[]) : []).join(", ")}
          value={value}
          onCommit={(raw) =>
            onChange(
              raw
                .split(",")
                .map((s) => Math.round(Number(s.trim())))
                .filter((n) => Number.isInteger(n) && n > 0),
            )
          }
        />
      );

    case "centsList":
      return (
        <RawTextField
          label={label}
          hint={field.hint ?? "Valores em reais, separados por vírgula."}
          error={error}
          serialize={(arr) =>
            (Array.isArray(arr) ? (arr as number[]) : []).map((c) => (c / 100).toString().replace(".", ",")).join(", ")
          }
          value={value}
          onCommit={(raw) =>
            onChange(
              raw
                .split(",")
                .map((s) => Math.round(Number(s.trim().replace(",", ".")) * 100))
                .filter((n) => Number.isFinite(n) && n > 0),
            )
          }
        />
      );

    case "stringList":
      return (
        <RawTextField
          label={label}
          hint={field.hint ?? "Um item por linha."}
          error={error}
          multiline
          serialize={(arr) => (Array.isArray(arr) ? (arr as string[]) : []).join("\n")}
          value={value}
          onCommit={(raw) =>
            onChange(
              raw
                .split("\n")
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean),
            )
          }
        />
      );

    case "faqList":
      return (
        <ListEditor
          label={label}
          value={value as { q: string; a: string }[]}
          blank={{ q: "", a: "" }}
          addLabel="Adicionar pergunta"
          onChange={onChange}
          row={(it, patch) => (
            <>
              <Input placeholder="Pergunta" value={it.q} onChange={(e) => patch({ q: e.target.value })} />
              <Textarea rows={2} placeholder="Resposta" value={it.a} onChange={(e) => patch({ a: e.target.value })} />
            </>
          )}
        />
      );

    case "imageList":
      return (
        <ListEditor
          label={label}
          value={value as { url: string; alt: string }[]}
          blank={{ url: "", alt: "" }}
          addLabel="Adicionar imagem"
          onChange={onChange}
          row={(it, patch) => (
            <>
              <Input placeholder="URL da imagem" value={it.url} onChange={(e) => patch({ url: e.target.value })} />
              <Input placeholder="Texto alternativo" value={it.alt} onChange={(e) => patch({ alt: e.target.value })} />
              <Thumb url={it.url} />
            </>
          )}
        />
      );

    case "testimonialList":
      return (
        <ListEditor
          label={label}
          value={value as { quote: string; author: string; role?: string; avatarUrl?: string }[]}
          blank={{ quote: "", author: "", role: "", avatarUrl: "" }}
          addLabel="Adicionar depoimento"
          onChange={onChange}
          row={(it, patch) => (
            <>
              <Textarea
                rows={2}
                placeholder="Depoimento"
                value={it.quote}
                onChange={(e) => patch({ quote: e.target.value })}
              />
              <Input placeholder="Nome" value={it.author} onChange={(e) => patch({ author: e.target.value })} />
              <Input
                placeholder="Papel (opcional)"
                value={it.role ?? ""}
                onChange={(e) => patch({ role: e.target.value })}
              />
              <Input
                type="url"
                placeholder="URL da foto (opcional)"
                value={it.avatarUrl ?? ""}
                onChange={(e) => patch({ avatarUrl: e.target.value || undefined })}
              />
            </>
          )}
        />
      );

    case "counterList":
      return (
        <ListEditor
          label={label}
          value={value as { value: number; suffix: string; label: string }[]}
          blank={{ value: 0, suffix: "", label: "" }}
          addLabel="Adicionar número"
          onChange={onChange}
          row={(it, patch) => (
            <>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Valor"
                  value={String(it.value)}
                  onChange={(e) => patch({ value: Number(e.target.value) || 0 })}
                />
                <Input placeholder="Sufixo" value={it.suffix} onChange={(e) => patch({ suffix: e.target.value })} />
              </div>
              <Input placeholder="Legenda" value={it.label} onChange={(e) => patch({ label: e.target.value })} />
            </>
          )}
        />
      );

    case "stepList":
      return (
        <ListEditor
          label={label}
          value={value as { title: string; body: string }[]}
          blank={{ title: "", body: "" }}
          addLabel="Adicionar passo"
          onChange={onChange}
          row={(it, patch) => (
            <>
              <Input
                placeholder="Título do passo"
                value={it.title}
                onChange={(e) => patch({ title: e.target.value })}
              />
              <Textarea
                rows={2}
                placeholder="Descrição"
                value={it.body}
                onChange={(e) => patch({ body: e.target.value })}
              />
            </>
          )}
        />
      );

    case "moneyList":
      return (
        <ListEditor
          label={label}
          value={value as { label: string; amountCents: number }[]}
          blank={{ label: "", amountCents: 0 }}
          addLabel="Adicionar item"
          onChange={onChange}
          row={(it, patch) => (
            <div className="flex gap-2">
              <Input
                placeholder="Item (ex.: Projeto)"
                value={it.label}
                onChange={(e) => patch({ label: e.target.value })}
              />
              <Input
                className="w-28"
                inputMode="decimal"
                placeholder="R$"
                value={it.amountCents ? (it.amountCents / 100).toString().replace(".", ",") : ""}
                onChange={(e) =>
                  patch({ amountCents: Math.round(Number(e.target.value.replace(",", ".")) * 100) || 0 })
                }
              />
            </div>
          )}
        />
      );

    default:
      return null;
  }
}

function Thumb({ url }: { url: string }) {
  const [broken, setBroken] = useState(false);
  if (!url) return null;
  if (broken) return <span className="mt-1.5 block text-xs text-muted">Não foi possível carregar a imagem.</span>;
  return (
    <span className="mt-1.5 block overflow-hidden rounded-md border border-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" onError={() => setBroken(true)} className="h-24 w-full bg-canvas object-contain" />
    </span>
  );
}

/** Text field for delimited lists — edits raw text, normalises on blur so the
 * cursor never jumps and blank separators are allowed mid-edit. */
function RawTextField({
  label,
  hint,
  error,
  multiline,
  value,
  serialize,
  onCommit,
}: {
  label: string;
  hint?: string;
  error?: string;
  multiline?: boolean;
  value: unknown;
  serialize: (v: unknown) => string;
  onCommit: (raw: string) => void;
}) {
  const [raw, setRaw] = useState<string | null>(null);
  const shown = raw ?? serialize(value);
  const commit = () => {
    if (raw !== null) onCommit(raw);
    setRaw(null);
  };
  return (
    <Field label={label} hint={hint} error={error}>
      {multiline ? (
        <Textarea rows={3} value={shown} onChange={(e) => setRaw(e.target.value)} onBlur={commit} />
      ) : (
        <Input value={shown} onChange={(e) => setRaw(e.target.value)} onBlur={commit} />
      )}
    </Field>
  );
}

/** Generic add/remove editor for object lists, with stable per-row keys so
 * removing a middle item doesn't smear values across the survivors. */
function ListEditor<T extends Record<string, unknown>>({
  label,
  value,
  blank,
  addLabel,
  onChange,
  row,
}: {
  label: string;
  value: T[] | undefined;
  blank: T;
  addLabel: string;
  onChange: (v: T[]) => void;
  row: (item: T, patch: (p: Partial<T>) => void) => ReactNode;
}) {
  const items = Array.isArray(value) ? value : [];
  const keys = useRef<number[]>([]);
  const nextKey = useRef(1);
  while (keys.current.length < items.length) keys.current.push(nextKey.current++);
  if (keys.current.length > items.length) keys.current.length = items.length;

  const set = (next: T[], nextKeys: number[]) => {
    keys.current = nextKeys;
    onChange(next);
  };

  return (
    <div className="grid gap-2">
      <span className="label">{label}</span>
      {items.map((it, i) => (
        <div key={keys.current[i]} className="grid gap-1.5 rounded-lg border border-line p-2.5">
          {row(it, (p) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x))))}
          <button
            type="button"
            onClick={() =>
              set(
                items.filter((_, j) => j !== i),
                keys.current.filter((_, j) => j !== i),
              )
            }
            className="inline-flex w-fit items-center gap-1 text-xs font-medium text-danger hover:underline"
          >
            <X className="size-3" /> Remover
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => set([...items, { ...blank }], [...keys.current, nextKey.current++])}
        className="btn-secondary btn-sm w-fit"
      >
        <Plus className="size-3.5" /> {addLabel}
      </button>
    </div>
  );
}
