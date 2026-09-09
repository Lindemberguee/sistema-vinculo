"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  saveCampaignImpact,
  createCampaignReport,
  deleteCampaignReport,
  type ActionResult,
} from "@/server/campaigns/actions";
import { Field, Input, Select, Switch, Button, cn } from "@/components/ui";
import { MoneyListInput } from "@/components/MoneyListInput";
import { SDG_GOALS, BIOMES, IMPACT_FOCUS } from "@/lib/impact";
import { SectionCard, SaveBar } from "./EssentialTab";

export interface ImpactValues {
  sdgGoals: number[];
  impactBiome: string;
  impactFocus: string;
  budget: { label: string; amountCents: number }[];
  showBudget: boolean;
  reports: { id: string; title: string; url: string; publishedAt: string }[];
}

export function ImpactTab({
  orgId,
  campaignId,
  initial,
}: {
  orgId: string;
  campaignId: string;
  initial: ImpactValues;
}) {
  const [impState, impAction, impPending] = useActionState<ActionResult | null, FormData>(
    saveCampaignImpact.bind(null, orgId, campaignId),
    null,
  );
  const [repState, repAction, repPending] = useActionState<ActionResult | null, FormData>(
    createCampaignReport.bind(null, orgId, campaignId),
    null,
  );
  const selected = new Set(initial.sdgGoals);
  const [showBudget, setShowBudget] = useState(initial.showBudget);

  return (
    <div className="space-y-5">
      <form action={impAction} className="space-y-5">
        <SectionCard title="Onde a campanha atua" desc="Usado nos filtros de busca e nos relatórios de impacto.">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Bioma">
              <Select name="impactBiome" defaultValue={initial.impactBiome}>
                <option value="">—</option>
                {BIOMES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Foco de impacto">
              <Select name="impactFocus" defaultValue={initial.impactFocus}>
                <option value="">—</option>
                {IMPACT_FOCUS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Objetivos de Desenvolvimento Sustentável (ODS)" desc="Objetivos da ONU com que a campanha se conecta. Escolha quantos quiser.">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Objetivos de Desenvolvimento Sustentável">
            {SDG_GOALS.map((g) => (
              <label
                key={g.n}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 text-xs transition-colors",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/40 has-[:focus-visible]:ring-offset-1",
                  selected.has(g.n)
                    ? "border-brand-600 bg-brand-50 font-medium text-brand-700"
                    : "border-line-strong text-muted hover:border-muted/40",
                )}
              >
                <input
                  type="checkbox"
                  name="sdgGoals"
                  value={g.n}
                  defaultChecked={selected.has(g.n)}
                  className="sr-only"
                />
                {g.n} · {g.label}
              </label>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Para onde vai o dinheiro" desc="Detalhe como os recursos serão aplicados.">
          <MoneyListInput name="budget" defaultValue={initial.budget} />
          <input type="hidden" name="showBudget" value={showBudget ? "true" : ""} />
          <Switch
            checked={showBudget}
            onCheckedChange={setShowBudget}
            label="Mostrar esse detalhamento na página da campanha"
          />
        </SectionCard>

        <SaveBar state={impState} pending={impPending} />
      </form>

      <SectionCard title="Prestação de contas" desc="Links para relatórios que mostram como o dinheiro foi usado.">
        {initial.reports.length > 0 && (
          <ul className="divide-y divide-line">
            {initial.reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <a href={r.url} target="_blank" rel="noreferrer" className="link min-w-0 truncate">
                  {r.title}
                </a>
                <DeleteReport orgId={orgId} reportId={r.id} />
              </li>
            ))}
          </ul>
        )}
        <form action={repAction} className="mt-2 grid gap-2.5 rounded-lg border border-line p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Título" error={repState?.fieldErrors?.title?.[0]}>
            <Input name="title" required />
          </Field>
          <Field label="Link do relatório" error={repState?.fieldErrors?.url?.[0]}>
            <Input name="url" type="url" placeholder="https://…" required />
          </Field>
          <Button type="submit" size="sm" loading={repPending}>
            {repPending ? "Adicionando…" : "Adicionar"}
          </Button>
        </form>
        {repState?.ok && (
          <p className="text-sm text-success" role="status" aria-live="polite">
            Relatório adicionado.
          </p>
        )}
      </SectionCard>
    </div>
  );
}

function DeleteReport({ orgId, reportId }: { orgId: string; reportId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Remover relatório"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await deleteCampaignReport(orgId, reportId);
          router.refresh();
        })
      }
      className="grid size-9 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-danger disabled:opacity-40"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
