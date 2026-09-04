"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, Plus, Send, X } from "lucide-react";
import { deleteDonorSegment, saveDonorSegment } from "@/server/crm/segments";
import { Button, Input, cn } from "@/components/ui";

export function SegmentBar({
  orgId,
  smartLists,
  activeSmart,
  saved,
  currentParams,
}: {
  orgId: string;
  smartLists: { key: string; label: string }[];
  activeSmart?: string;
  saved: { id: string; name: string; filters: Record<string, string> }[];
  /** Current list query params (already without `page`). */
  currentParams: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const hasFilters = Object.keys(currentParams).length > 0;
  const activeSaved = (f: Record<string, string>) => sameParams(f, currentParams);

  const save = () =>
    start(async () => {
      setErr(null);
      const r = await saveDonorSegment(orgId, name.trim(), currentParams);
      if (r.ok) {
        setAdding(false);
        setName("");
        router.refresh();
      } else {
        setErr(r.error ?? "Falha ao salvar");
      }
    });

  const remove = (id: string) =>
    start(async () => {
      await deleteDonorSegment(orgId, id);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow mr-1">Segmentos</span>

      {smartLists.map((s) => (
        <Link
          key={s.key}
          href={`?smart=${s.key}`}
          aria-current={activeSmart === s.key ? "true" : undefined}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            activeSmart === s.key
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-line-strong text-muted hover:border-muted/40 hover:text-ink",
          )}
        >
          {s.label}
        </Link>
      ))}

      {saved.length > 0 && <span className="mx-0.5 h-4 w-px bg-line" />}

      {saved.map((s) => {
        const on = activeSaved(s.filters);
        return (
          <span
            key={s.id}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
              on ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line-strong text-muted",
            )}
          >
            <Link href={`?${new URLSearchParams(s.filters).toString()}`} className="inline-flex items-center gap-1">
              <Bookmark className="size-3" />
              {s.name}
            </Link>
            <button
              type="button"
              onClick={() => remove(s.id)}
              disabled={pending}
              aria-label={`Excluir segmento ${s.name}`}
              className="text-faint hover:text-danger"
            >
              <X className="size-3" />
            </button>
          </span>
        );
      })}

      {hasFilters && !adding && (
        <Link
          href={`/orgs/${orgId}/broadcasts/new?${new URLSearchParams(currentParams).toString()}`}
          className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2.5 py-1 text-xs font-medium text-muted hover:border-muted/40 hover:text-ink"
        >
          <Send className="size-3" /> Enviar e-mail
        </Link>
      )}

      {adding ? (
        <span className="inline-flex items-center gap-1.5">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="nome do segmento"
            maxLength={40}
            className="h-7 w-40 text-xs"
            onKeyDown={(e) => e.key === "Enter" && name.trim().length >= 2 && save()}
          />
          <Button size="sm" disabled={pending || name.trim().length < 2} onClick={save}>
            Salvar
          </Button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setErr(null);
            }}
            className="text-xs text-muted hover:text-ink"
          >
            Cancelar
          </button>
          {err && <span className="field-error">{err}</span>}
        </span>
      ) : (
        hasFilters && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 py-1 text-xs font-medium text-muted hover:border-muted/40 hover:text-ink"
          >
            <Plus className="size-3" /> Salvar filtro atual
          </button>
        )
      )}
    </div>
  );
}

function sameParams(a: Record<string, string>, b: Record<string, string>): boolean {
  const ak = Object.keys(a).filter((k) => a[k]);
  const bk = Object.keys(b).filter((k) => b[k]);
  if (ak.length === 0 || ak.length !== bk.length) return false;
  return ak.every((k) => a[k] === b[k]);
}
