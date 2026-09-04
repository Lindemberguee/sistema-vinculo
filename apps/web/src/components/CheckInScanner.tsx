"use client";

import { useRef, useState, useTransition } from "react";
import { checkInTicket, type CheckInResult } from "@/server/events/actions";
import { Button } from "@/components/ui";

export function CheckInScanner({ orgId, eventId }: { orgId: string; eventId: string }) {
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [count, setCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    start(async () => {
      const r = await checkInTicket(orgId, eventId, c);
      setResult(r);
      if (r.ok) setCount((n) => n + 1);
      setCode("");
      inputRef.current?.focus();
    });
  }

  return (
    <div className="max-w-md">
      <form onSubmit={submit} className="flex gap-2">
        <input
          ref={inputRef}
          autoFocus
          className="input"
          placeholder="Escaneie ou digite o código"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Button type="submit" disabled={pending}>
          Validar
        </Button>
      </form>

      {result && (
        <div
          className={
            "mt-4 rounded-xl border p-4 " +
            (result.ok ? "border-transparent bg-success-bg text-success" : "border-transparent bg-danger-bg text-danger")
          }
        >
          <div className="text-lg font-semibold">{result.ok ? "✓ Entrada liberada" : "✗ " + (result.error ?? "Inválido")}</div>
          {(result.attendee || result.typeName) && (
            <div className="mt-1 text-sm">
              {result.attendee ?? "sem nome"} · {result.typeName}
            </div>
          )}
          {result.alreadyUsedAt && <div className="mt-1 text-sm">Já usado em {result.alreadyUsedAt}</div>}
        </div>
      )}

      <p className="mt-4 text-sm text-muted">Validados nesta sessão: {count}</p>
    </div>
  );
}
