"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Input, Textarea } from "@/components/ui";

interface Row {
  q: string;
  a: string;
}

/**
 * Dynamic list of {q,a} rows that serialises to a single hidden JSON input, so it
 * drops into a plain `<form action={serverAction}>` without extra plumbing.
 */
export function KeyValueListInput({
  name,
  defaultValue,
  qLabel = "Pergunta",
  aLabel = "Resposta",
  addLabel = "Adicionar pergunta",
}: {
  name: string;
  defaultValue: Row[];
  qLabel?: string;
  aLabel?: string;
  addLabel?: string;
}) {
  const [rows, setRows] = useState<Row[]>(defaultValue.length ? defaultValue : []);
  const keys = useRef<number[]>(rows.map((_, i) => i));
  const next = useRef(rows.length);

  const patch = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const add = () => {
    keys.current = [...keys.current, next.current++];
    setRows((r) => [...r, { q: "", a: "" }]);
  };
  const remove = (i: number) => {
    keys.current = keys.current.filter((_, j) => j !== i);
    setRows((r) => r.filter((_, j) => j !== i));
  };

  return (
    <div className="grid gap-2">
      {rows.map((row, i) => (
        <div key={keys.current[i]} className="grid gap-1.5 rounded-lg border border-line p-2.5">
          <Input placeholder={qLabel} value={row.q} onChange={(e) => patch(i, { q: e.target.value })} />
          <Textarea rows={2} placeholder={aLabel} value={row.a} onChange={(e) => patch(i, { a: e.target.value })} />
          <button
            type="button"
            onClick={() => remove(i)}
            className="inline-flex w-fit items-center gap-1 text-xs font-medium text-danger hover:underline"
          >
            <X className="size-3" /> Remover
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="btn-secondary btn-sm w-fit">
        <Plus className="size-3.5" /> {addLabel}
      </button>
      <input type="hidden" name={name} value={JSON.stringify(rows.filter((r) => r.q.trim() || r.a.trim()))} />
    </div>
  );
}
