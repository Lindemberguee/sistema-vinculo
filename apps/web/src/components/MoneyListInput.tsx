"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui";

interface Row {
  label: string;
  amountCents: number;
}

const reais = (c: number) => (c ? (c / 100).toString().replace(".", ",") : "");
const toCents = (s: string) => Math.round(Number(s.replace(",", ".")) * 100) || 0;

/** Dynamic list of {label, amountCents} → single hidden JSON input. */
export function MoneyListInput({
  name,
  defaultValue,
  addLabel = "Adicionar item",
}: {
  name: string;
  defaultValue: Row[];
  addLabel?: string;
}) {
  const [rows, setRows] = useState<Row[]>(defaultValue);
  const keys = useRef<number[]>(defaultValue.map((_, i) => i));
  const next = useRef(defaultValue.length);
  const total = rows.reduce((s, r) => s + r.amountCents, 0);

  const patch = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const add = () => {
    keys.current = [...keys.current, next.current++];
    setRows((r) => [...r, { label: "", amountCents: 0 }]);
  };
  const remove = (i: number) => {
    keys.current = keys.current.filter((_, j) => j !== i);
    setRows((r) => r.filter((_, j) => j !== i));
  };

  return (
    <div className="grid gap-2">
      {rows.map((row, i) => (
        <div key={keys.current[i]} className="flex items-center gap-2">
          <Input
            placeholder="Item (ex.: Projeto)"
            value={row.label}
            onChange={(e) => patch(i, { label: e.target.value })}
          />
          <Input
            className="w-28 shrink-0"
            inputMode="decimal"
            placeholder="R$"
            value={reais(row.amountCents)}
            onChange={(e) => patch(i, { amountCents: toCents(e.target.value) })}
          />
          <button
            type="button"
            aria-label="Remover item"
            onClick={() => remove(i)}
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-canvas hover:text-danger"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" onClick={add} className="btn-secondary btn-sm">
          <Plus className="size-3.5" /> {addLabel}
        </button>
        {rows.length > 0 && (
          <span className="text-xs text-muted">
            Total: <span className="font-medium text-ink tabular-nums">R$ {reais(total) || "0"}</span>
          </span>
        )}
      </div>
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(rows.filter((r) => r.label.trim() && r.amountCents > 0))}
      />
    </div>
  );
}
