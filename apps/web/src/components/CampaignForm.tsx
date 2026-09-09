"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Heart, HandCoins, CalendarDays, Users } from "lucide-react";
import { createCampaignFormAction, type ActionResult } from "@/server/campaigns/actions";
import { Field, Input, Button, cn } from "@/components/ui";

const TYPES = [
  { value: "DONATION", label: "Doação", desc: "Doações contínuas para a causa", icon: Heart },
  { value: "CROWDFUNDING", label: "Vaquinha", desc: "Uma meta e um prazo", icon: HandCoins },
  { value: "APADRINHAMENTO", label: "Apadrinhamento", desc: "Apoio mensal a uma pessoa", icon: Users },
  { value: "EVENT", label: "Evento", desc: "Venda de ingressos", icon: CalendarDays },
] as const;

const DIACRITICS = /[̀-ͯ]/g;
function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Focused "create a campaign" step — the org fine-tunes everything else in the
 * block editor it lands on right after. */
export function CampaignForm({ orgId }: { orgId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createCampaignFormAction.bind(null, orgId),
    null,
  );
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("DONATION");
  const [goal, setGoal] = useState("");

  const effectiveSlug = slugTouched && slug ? slug : slugify(title);

  const previewHost = useMemo(() => {
    if (typeof window === "undefined") return "suaong.plataforma.com.br";
    const parts = window.location.host.split(".");
    return `suaong.${parts.slice(1).join(".") || "plataforma.com.br"}`;
  }, []);

  return (
    <form action={formAction} className="mt-2 max-w-xl">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <Field label="Título da campanha" required error={err("title")}>
          <Input
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Água limpa para todos"
            className="text-base"
            autoFocus
            required
          />
        </Field>

        <div className="mt-4">
          <Field label="Endereço da página" required error={err("slug")}>
            <Input
              name="slug"
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="agua-limpa"
              inputMode="url"
              required
            />
          </Field>
          <p className="mt-1 truncate text-xs text-muted">
            {previewHost}/<span className="font-medium text-ink">{effectiveSlug || "…"}</span>
          </p>
        </div>

        <fieldset className="mt-5 border-0 p-0">
          <legend className="label mb-2">Tipo de campanha</legend>
          <div role="radiogroup" aria-label="Tipo de campanha" className="grid gap-2 sm:grid-cols-2">
            {TYPES.map((t) => {
              const active = type === t.value;
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setType(t.value)}
                  className={cn(
                    "relative flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                    active
                      ? "border-brand-600 bg-brand-50"
                      : "border-line-strong hover:border-muted/40 hover:bg-canvas",
                  )}
                >
                  {active && <Check className="absolute right-2 top-2 size-3.5 text-brand-700" aria-hidden />}
                  <Icon
                    className={cn("mt-0.5 size-4 shrink-0", active ? "text-brand-700" : "text-muted")}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{t.label}</span>
                    <span className="block text-xs text-muted">{t.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <input type="hidden" name="type" value={type} />
        </fieldset>

        <div className="mt-5">
          <Field label="Meta de arrecadação" optional error={err("goalReais")}>
            <div className="flex items-center rounded-md border border-line-strong bg-surface transition-[border-color,box-shadow] duration-150 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15">
              <span className="pl-3 text-sm font-medium text-muted" aria-hidden>
                R$
              </span>
              <input
                name="goalReais"
                value={goal}
                onChange={(e) => setGoal(e.target.value.replace(/[^\d.,]/g, ""))}
                inputMode="decimal"
                placeholder="0,00"
                className="min-h-11 w-full bg-transparent px-2 text-sm text-ink tabular-nums placeholder:text-faint focus:outline-none"
              />
            </div>
          </Field>
          <p className="mt-1 text-xs text-muted">Mostra uma barra de progresso na página. Deixe em branco se não tiver meta.</p>
        </div>

        {/* Deferred to the editor — sent with sensible defaults so the schema is happy. */}
        <input type="hidden" name="summary" value="" />
        <input type="hidden" name="minAmountReais" value="5" />
        <input type="hidden" name="suggestedAmountsCents" value="20, 50, 100, 250" />
        <input type="hidden" name="allowRecurring" value="true" />
        <input type="hidden" name="allowTip" value="true" />
        <input type="hidden" name="seoTitle" value="" />
        <input type="hidden" name="seoDescription" value="" />

        {state?.error && (
          <p className="mt-4 field-error" role="alert">
            {state.error}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" loading={pending} disabled={title.trim().length < 3}>
          {pending ? "Criando…" : "Criar e abrir o editor"}
        </Button>
        <span className="text-xs text-muted">Valores, textos e blocos você ajusta no editor.</span>
      </div>
    </form>
  );
}
