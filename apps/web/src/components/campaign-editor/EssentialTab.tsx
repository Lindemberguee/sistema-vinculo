"use client";

import { useActionState, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { saveCampaignEssentials, type ActionResult } from "@/server/campaigns/actions";
import { Field, Input, Textarea, Select, Button } from "@/components/ui";
import { StoryEditor } from "@/components/StoryEditor";
import { CAMPAIGN_CATEGORIES } from "@/lib/campaign-category";

export interface EssentialValues {
  title: string;
  slug: string;
  slogan: string;
  category: string;
  summary: string;
  story: string;
  galleryUrls: string;
  videoUrl: string;
}

export function EssentialTab({
  orgId,
  campaignId,
  initial,
}: {
  orgId: string;
  campaignId: string;
  initial: EssentialValues;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveCampaignEssentials.bind(null, orgId, campaignId),
    null,
  );
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  return (
    <form action={action} className="space-y-5">
      <SectionCard title="Conteúdo" desc="Apresente o projeto com clareza e impacto.">
        <Field
          label="Nome da campanha"
          error={err("title")}
          hint="Curto e direto. Aparece na busca e no compartilhamento."
        >
          <Input name="title" defaultValue={initial.title} maxLength={120} required />
        </Field>
        <Field label="Slogan" error={err("slogan")} hint="Uma frase que completa o título. Opcional.">
          <Input name="slogan" defaultValue={initial.slogan} maxLength={120} />
        </Field>
        <Field label="Endereço (slug)" error={err("slug")} hint="Vai na URL: slug.suaong.plataforma.com.br">
          <Input name="slug" defaultValue={initial.slug} required />
        </Field>
        <Field label="Categoria" error={err("category")} hint="Ajuda o doador a encontrar a campanha.">
          <Select name="category" defaultValue={initial.category}>
            {CAMPAIGN_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Resumo" error={err("summary")} hint="Aparece na listagem e nos buscadores.">
          <Textarea name="summary" defaultValue={initial.summary} rows={2} maxLength={400} />
        </Field>
      </SectionCard>

      <SectionCard title="A história" desc="Quem precisa de ajuda, o que aconteceu e o que muda com a doação.">
        <StoryEditor name="story" defaultValue={initial.story} />
      </SectionCard>

      <SectionCard title="Galeria" desc="Fotos e vídeo que aparecem no topo da página. Até 6 fotos.">
        <Field label="Fotos da galeria" hint="Uma URL de imagem por linha.">
          <Textarea name="galleryUrls" defaultValue={initial.galleryUrls} rows={3} placeholder="https://…/foto1.jpg" />
        </Field>
        <Field label="Vídeo (YouTube ou Vimeo)" error={err("videoUrl")} hint="Opcional.">
          <Input name="videoUrl" type="url" defaultValue={initial.videoUrl} placeholder="https://youtu.be/…" />
        </Field>
      </SectionCard>

      <SaveBar state={state} pending={pending} />
    </form>
  );
}

export function SectionCard({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {desc && <p className="mt-0.5 text-xs text-muted">{desc}</p>}
      <div className="mt-4 space-y-3.5">{children}</div>
    </section>
  );
}

export function SaveBar({ state, pending }: { state: ActionResult | null; pending: boolean }) {
  const [savedShown, setSavedShown] = useState(false);
  useEffect(() => {
    if (!state?.ok) return;
    setSavedShown(true);
    const t = setTimeout(() => setSavedShown(false), 4000);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <div
      className="sticky bottom-3 z-10 mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface/95 px-3 py-2.5 shadow-card backdrop-blur"
      style={{ marginBottom: "max(0px, env(safe-area-inset-bottom))" }}
    >
      <Button type="submit" loading={pending}>
        {pending ? "Salvando…" : "Salvar alterações"}
      </Button>
      {savedShown && (
        <span className="inline-flex items-center gap-1.5 text-sm text-success" role="status" aria-live="polite">
          <Check className="size-4" aria-hidden />
          Alterações salvas
        </span>
      )}
      {state?.error && (
        <span className="field-error" role="alert">
          {state.error}
        </span>
      )}
    </div>
  );
}
