"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDonorTag, removeDonorTag } from "@/server/crm/actions";
import { Button } from "@/components/ui";

export function DonorTagsEditor({
  orgId,
  donorId,
  tags,
}: {
  orgId: string;
  donorId: string;
  tags: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Falha");
      else {
        setError(null);
        setValue("");
        router.refresh();
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((t) => (
        <span key={t} className="badge-neutral">
          {t}
          <button
            disabled={pending}
            onClick={() => run(() => removeDonorTag(orgId, donorId, t))}
            className="text-muted hover:text-danger"
            aria-label={`remover ${t}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="nova tag"
        className="input w-32 text-xs"
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={pending || value.trim().length === 0}
        onClick={() => run(() => addDonorTag(orgId, donorId, value))}
      >
        Adicionar
      </Button>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
