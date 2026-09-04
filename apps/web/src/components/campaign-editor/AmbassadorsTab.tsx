"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAmbassadorStatus, deleteAmbassador } from "@/server/ambassadors/actions";
import { Button, Badge } from "@/components/ui";
import { SectionCard } from "./EssentialTab";

type AmbassadorStatus = "ACTIVE" | "HIDDEN" | "BLOCKED";

export interface AmbassadorRow {
  id: string;
  slug: string;
  name: string;
  email: string;
  headline: string;
  photoUrl: string;
  goalCents: number | null;
  status: AmbassadorStatus;
  donationsCount: number;
  raisedCents: number;
}

const brl = (c: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);

const STATUS: Record<AmbassadorStatus, { label: string; tone: "success" | "warn" | "danger" }> = {
  ACTIVE: { label: "Ativo", tone: "success" },
  HIDDEN: { label: "Oculto", tone: "warn" },
  BLOCKED: { label: "Bloqueado", tone: "danger" },
};

export function AmbassadorsTab({
  orgId,
  campaignSlug,
  publicOrigin,
  allowAmbassadors,
  ambassadors,
}: {
  orgId: string;
  campaignSlug: string;
  publicOrigin: string;
  allowAmbassadors: boolean;
  ambassadors: AmbassadorRow[];
}) {
  if (!allowAmbassadors) {
    return (
      <SectionCard title="Embaixadores" desc="Deixe apoiadores criarem páginas de arrecadação para esta campanha.">
        <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
          Ative <strong>“Aceitar embaixadores”</strong> na aba{" "}
          <a href={`?tab=ajustes`} className="link">
            Ajustes
          </a>{" "}
          para liberar este recurso.
        </p>
      </SectionCard>
    );
  }

  const joinUrl = `${publicOrigin}/${campaignSlug}/embaixador`;
  const total = ambassadors.reduce((s, a) => s + a.raisedCents, 0);
  const active = ambassadors.filter((a) => a.status === "ACTIVE").length;

  return (
    <div className="space-y-5">
      <SectionCard title="Link para virar embaixador" desc="Divulgue este endereço para quem quer arrecadar pela campanha.">
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md bg-canvas px-2.5 py-1.5 text-xs text-ink">{joinUrl}</code>
          <CopyButton value={joinUrl} />
          <a href={joinUrl} target="_blank" rel="noreferrer" className="link shrink-0 text-xs">
            Abrir
          </a>
        </div>
      </SectionCard>

      <SectionCard
        title="Embaixadores"
        desc={
          ambassadors.length
            ? `${active} ativo(s) · ${brl(total)} arrecadados no total`
            : "Ninguém criou uma página ainda."
        }
      >
        {ambassadors.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
            Compartilhe o link acima para os primeiros embaixadores começarem.
          </p>
        ) : (
          <ul className="space-y-3">
            {ambassadors.map((a, i) => (
              <li key={a.id}>
                <AmbassadorCard orgId={orgId} rank={i + 1} publicOrigin={publicOrigin} a={a} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function AmbassadorCard({
  orgId,
  rank,
  publicOrigin,
  a,
}: {
  orgId: string;
  rank: number;
  publicOrigin: string;
  a: AmbassadorRow;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const url = `${publicOrigin}/embaixador/${a.slug}`;
  const pct = a.goalCents && a.goalCents > 0 ? Math.min(100, Math.round((a.raisedCents / a.goalCents) * 100)) : null;

  function act(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-5 shrink-0 text-center text-sm font-semibold text-faint">{rank}</span>
        {a.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.photoUrl} alt={a.name} className="size-10 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-canvas text-sm font-semibold text-muted">
            {a.name.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{a.name}</span>
            <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
          </div>
          <div className="truncate text-xs text-muted">{a.email}</div>
          {a.headline && <div className="mt-0.5 truncate text-xs text-muted">“{a.headline}”</div>}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular-nums">{brl(a.raisedCents)}</div>
          <div className="text-xs text-muted">
            {a.donationsCount} {a.donationsCount === 1 ? "doação" : "doações"}
            {pct != null ? ` · ${pct}% da meta` : ""}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a href={url} target="_blank" rel="noreferrer" className="link text-xs">
          Ver página
        </a>
        <span className="text-line-strong">·</span>
        {a.status === "ACTIVE" ? (
          <button
            type="button"
            onClick={() => act(() => setAmbassadorStatus(orgId, a.id, "HIDDEN"))}
            disabled={pending}
            className="text-xs font-medium text-muted hover:text-ink hover:underline"
          >
            Ocultar do ranking
          </button>
        ) : a.status === "HIDDEN" ? (
          <button
            type="button"
            onClick={() => act(() => setAmbassadorStatus(orgId, a.id, "ACTIVE"))}
            disabled={pending}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Reativar
          </button>
        ) : null}
        {a.status !== "BLOCKED" ? (
          <button
            type="button"
            onClick={() => {
              if (confirm("Bloquear este embaixador? A página dele para de funcionar.")) {
                act(() => setAmbassadorStatus(orgId, a.id, "BLOCKED"));
              }
            }}
            disabled={pending}
            className="text-xs font-medium text-danger hover:underline"
          >
            Bloquear
          </button>
        ) : (
          <button
            type="button"
            onClick={() => act(() => setAmbassadorStatus(orgId, a.id, "ACTIVE"))}
            disabled={pending}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Desbloquear
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm("Excluir este embaixador? As doações já feitas continuam registradas.")) {
              act(() => deleteAmbassador(orgId, a.id));
            }
          }}
          disabled={pending}
          className="ml-auto text-xs font-medium text-muted hover:text-danger hover:underline"
        >
          Excluir
        </button>
      </div>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {copied ? "Copiado!" : "Copiar"}
    </Button>
  );
}
