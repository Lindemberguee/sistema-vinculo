"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { createBroadcast } from "@/server/crm/broadcasts";
import { Field, Input, Textarea, Select, Button, useConfirm } from "@/components/ui";

export interface SegmentOption {
  /** stable key */
  id: string;
  label: string;
  /** query-param object that reproduces this segment */
  params: Record<string, string>;
}

export function BroadcastComposer({
  orgId,
  filters,
  hasFilters,
  segmentOptions,
  preview,
}: {
  orgId: string;
  filters: Record<string, string>;
  hasFilters: boolean;
  segmentOptions: SegmentOption[];
  preview: { recipientCount: number; sample: { name: string; email: string }[] } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { confirm, dialog } = useConfirm();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("Olá, {nome}!\n\n");
  const [scheduledAt, setScheduledAt] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // datetime-local needs a "YYYY-MM-DDTHH:mm" min in local time
  const minLocal = new Date(Date.now() + 5 * 60_000 - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  const pickSegment = (id: string) => {
    const opt = segmentOptions.find((o) => o.id === id);
    router.push(opt ? `?${new URLSearchParams(opt.params).toString()}` : "?");
  };

  const submit = (mode: "draft" | "send" | "schedule") =>
    start(async () => {
      setErr(null);
      if (mode === "send") {
        const ok = await confirm({
          title: `Enviar para ${preview?.recipientCount ?? 0} doador(es)?`,
          description: "O envio começa imediatamente e não pode ser desfeito.",
          confirmLabel: "Enviar agora",
        });
        if (!ok) return;
      }
      if (mode === "schedule" && !scheduledAt) {
        setErr("Escolha a data e a hora do envio.");
        return;
      }
      const r = await createBroadcast(orgId, {
        name,
        subject,
        bodyText: body,
        filters,
        send: mode === "send",
        scheduledAt: mode === "schedule" ? new Date(scheduledAt).toISOString() : undefined,
      });
      if (r && !r.ok) setErr(r.error ?? "Falha ao salvar.");
      // on success the action redirects to the list
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="min-w-0 space-y-4">
        <div className="card p-4">
          <label className="grid gap-1.5">
            <span className="label">Segmento</span>
            <Select
              value=""
              onChange={(e) => pickSegment(e.target.value)}
              aria-label="Escolher segmento"
            >
              <option value="" disabled>
                {hasFilters ? "Trocar segmento…" : "Escolha um segmento…"}
              </option>
              {segmentOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
            <span className="hint">
              Você também pode chegar aqui pela lista de Doadores, com um filtro aplicado.
            </span>
          </label>
        </div>

        {hasFilters && preview ? (
          <div className="card space-y-4 p-4">
            <Field label="Nome interno" hint="Opcional — só para você identificar depois.">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </Field>
            <Field label="Assunto">
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} required />
            </Field>
            <Field
              label="Mensagem"
              hint="Texto simples. Use {nome} e {organização} — linhas em branco viram parágrafos."
            >
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} maxLength={8000} required />
            </Field>
            <Field label="Agendar envio" hint="Opcional — deixe em branco para enviar ou salvar agora.">
              <Input
                type="datetime-local"
                value={scheduledAt}
                min={minLocal}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </Field>
            {err && (
              <p className="field-error" role="alert">
                {err}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {scheduledAt ? (
                <Button
                  type="button"
                  loading={pending}
                  disabled={subject.trim().length < 3 || body.trim().length < 5}
                  onClick={() => submit("schedule")}
                >
                  {pending ? "Agendando…" : `Agendar para ${preview.recipientCount}`}
                </Button>
              ) : (
                <Button
                  type="button"
                  loading={pending}
                  disabled={subject.trim().length < 3 || body.trim().length < 5}
                  onClick={() => submit("send")}
                >
                  {pending ? "Enviando…" : `Enviar para ${preview.recipientCount}`}
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => submit("draft")}>
                Salvar rascunho
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center text-sm text-muted">
            Escolha um segmento acima para compor a mensagem.
          </p>
        )}
      </div>

      <aside className="space-y-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4 text-brand-600" />
            {preview ? `${preview.recipientCount} destinatário(s)` : "Nenhum segmento"}
          </div>
          <p className="mt-1 text-xs text-muted">Doadores que não recusaram e-mail.</p>
          {preview && preview.sample.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {preview.sample.map((s) => (
                <li key={s.email} className="truncate">
                  {s.name} <span className="text-faint">· {s.email}</span>
                </li>
              ))}
              {preview.recipientCount > preview.sample.length && (
                <li className="text-faint">e mais {preview.recipientCount - preview.sample.length}…</li>
              )}
            </ul>
          )}
        </div>
      </aside>
      {dialog}
    </div>
  );
}
