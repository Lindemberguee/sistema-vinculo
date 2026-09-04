"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Field, Input, Textarea } from "@/components/ui";
import { saveCampaignSeo } from "@/server/campaigns/actions";

type Save = "idle" | "saving" | "saved" | "error";

/** "Página" tab of the Inspector — campaign-level SEO. Autosaves like the canvas. */
export function PageSettingsPanel({
  orgId,
  campaignId,
  campaignSlug,
  seo,
}: {
  orgId: string;
  campaignId: string;
  campaignSlug: string;
  seo: { title: string; description: string };
}) {
  const [title, setTitle] = useState(seo.title);
  const [description, setDescription] = useState(seo.description);
  const [save, setSave] = useState<Save>("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const first = useRef(true);
  const reqId = useRef(0);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSave("saving");
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const res = await saveCampaignSeo(orgId, campaignId, { title, description });
      if (id !== reqId.current) return; // stale
      setSave(res.ok ? "saved" : "error");
      setMsg(res.ok ? null : (res.error ?? "Erro ao salvar"));
    }, 1000);
    return () => clearTimeout(t);
  }, [title, description, orgId, campaignId]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (save === "saving" || save === "error") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  return (
    <div className="space-y-4">
      <div>
        <div className="eyebrow">Endereço</div>
        <div className="mt-0.5 text-sm text-muted">/{campaignSlug}</div>
      </div>

      <Field label="Título para busca (SEO)" hint="Aparece na aba do navegador e nos resultados do Google.">
        <Input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Descrição para busca" hint="Resumo curto exibido abaixo do título no Google.">
        <Textarea rows={3} maxLength={320} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <p className="text-xs" aria-live="polite">
        {save === "saving" && <span className="text-muted">salvando…</span>}
        {save === "saved" && <span className="text-muted">salvo</span>}
        {save === "error" && <span className="text-danger">{msg}</span>}
      </p>

      <hr className="border-line" />
      <Link href={`/orgs/${orgId}/campaigns/${campaignId}`} className="link text-sm">
        Configurações completas da campanha
      </Link>
    </div>
  );
}
