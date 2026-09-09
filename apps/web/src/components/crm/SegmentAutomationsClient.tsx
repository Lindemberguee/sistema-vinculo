"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createSegmentAutomation,
  deleteSegmentAutomation,
  sendAnnualStatements,
  toggleSegmentAutomation,
} from "@/server/crm/segment-automations";
import { Field, Input, Select, Button, Badge, useConfirm } from "@/components/ui";

interface Opt {
  value: string;
  label: string;
}
export interface AutomationRow {
  id: string;
  segmentName: string;
  templateLabel: string;
  delayDays: number;
  enabled: boolean;
  sentCount: number;
}

export function AnnualStatementCard({ orgId, years }: { orgId: string; years: number[] }) {
  const [year, setYear] = useState(years[0]!);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { confirm, dialog } = useConfirm();

  return (
    <div className="card space-y-3 p-4">
      {dialog}
      <div>
        <h2 className="text-sm font-semibold">Informe anual de doações</h2>
        <p className="mt-1 text-xs text-muted">
          Envia a cada doador o resumo do que ele doou no ano. Só para quem consentiu receber e-mails; roda
          em segundo plano. Requer o template <strong>Informe anual de doações</strong> ligado.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1">
          <span className="label">Ano</span>
          <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={pending}
          onClick={() =>
            start(async () => {
              setMsg(null);
              const ok = await confirm({
                title: `Enviar o informe anual de ${year}?`,
                description: "Vai para todos os doadores desse ano que consentiram receber e-mails.",
                confirmLabel: "Enviar",
              });
              if (!ok) return;
              const r = await sendAnnualStatements(orgId, year);
              setMsg(
                r.ok
                  ? { ok: true, text: "Disparo iniciado. Os e-mails saem em instantes." }
                  : { ok: false, text: r.error ?? "Falha" },
              );
            })
          }
        >
          {pending ? "Enviando…" : "Enviar agora"}
        </Button>
      </div>
      {msg && (
        <p
          className={msg.ok ? "text-xs font-medium text-success" : "field-error"}
          role={msg.ok ? "status" : "alert"}
          aria-live="polite"
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}

export function SegmentAutomationForm({
  orgId,
  segments,
  templates,
}: {
  orgId: string;
  segments: Opt[];
  templates: Opt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [segmentId, setSegmentId] = useState(segments[0]?.value ?? "");
  const [templateKind, setTemplateKind] = useState(templates[0]?.value ?? "");
  const [delayDays, setDelayDays] = useState(3);
  const [err, setErr] = useState<string | null>(null);

  if (segments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
        Crie um segmento primeiro: vá em <a href={`/orgs/${orgId}/donors`} className="link">Doadores</a>, aplique
        um filtro e salve como segmento.
      </div>
    );
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1fr_7rem_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setErr(null);
          const r = await createSegmentAutomation(orgId, { segmentId, templateKind, delayDays });
          if (!r.ok) setErr(r.error ?? "Falha");
          else router.refresh();
        });
      }}
    >
      <Field label="Segmento">
        <Select value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
          {segments.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Enviar o template">
        <Select value={templateKind} onChange={(e) => setTemplateKind(e.target.value)}>
          {templates.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Após (dias)">
        <Input
          type="number"
          min={0}
          max={90}
          value={delayDays}
          onChange={(e) => setDelayDays(Math.max(0, Math.min(90, Number(e.target.value) || 0)))}
        />
      </Field>
      <Button type="submit" size="sm" loading={pending}>
        {pending ? "Criando…" : "Criar gatilho"}
      </Button>
      {err && (
        <p className="field-error sm:col-span-4" role="alert">
          {err}
        </p>
      )}
    </form>
  );
}

export function AutomationRowActions({
  orgId,
  row,
}: {
  orgId: string;
  row: AutomationRow;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setErr(null);
      const r = await fn();
      if (r.ok) router.refresh();
      else setErr(r.error ?? "Falha");
    });

  return (
    <div className="flex items-center justify-end gap-2">
      {err && (
        <span className="text-xs text-danger" role="alert">
          {err}
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => run(() => toggleSegmentAutomation(orgId, row.id))}
      >
        {row.enabled ? "Pausar" : "Ativar"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={async () => {
          const ok = await confirm({
            title: "Excluir este gatilho?",
            description: `“${row.templateLabel}” para o segmento “${row.segmentName}” deixa de rodar.`,
            confirmLabel: "Excluir",
            tone: "danger",
          });
          if (ok) run(() => deleteSegmentAutomation(orgId, row.id));
        }}
      >
        Excluir
      </Button>
      {dialog}
    </div>
  );
}

export function AutomationStatusBadge({ enabled }: { enabled: boolean }) {
  return <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "Ativa" : "Pausada"}</Badge>;
}
