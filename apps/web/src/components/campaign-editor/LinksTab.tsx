"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createDonationLink,
  updateDonationLink,
  setDonationLinkStatus,
  deleteDonationLink,
  type ActionResult,
} from "@/server/links/actions";
import { Field, Input, Checkbox, Button, Badge, cn } from "@/components/ui";
import { SectionCard, SaveBar } from "./EssentialTab";

type LinkStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";

export interface LinkValues {
  id: string;
  slug: string;
  title: string;
  note: string;
  amountReais: string;
  suggestedAmountsReais: string;
  lockAmount: boolean;
  defaultRecurring: boolean;
  defaultCoverFee: boolean;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  status: LinkStatus;
  expiresAt: string;
  visits: number;
  donationsCount: number;
  raisedCents: number;
}

const brl = (c: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);

const STATUS: Record<LinkStatus, { label: string; tone: "success" | "warn" | "neutral" }> = {
  ACTIVE: { label: "Ativo", tone: "success" },
  PAUSED: { label: "Pausado", tone: "warn" },
  ARCHIVED: { label: "Arquivado", tone: "neutral" },
};

export function LinksTab({
  orgId,
  campaignId,
  publicOrigin,
  links,
}: {
  orgId: string;
  campaignId: string;
  publicOrigin: string;
  links: LinkValues[];
}) {
  const visible = links.filter((l) => l.status !== "ARCHIVED");
  const archived = links.filter((l) => l.status === "ARCHIVED");

  return (
    <div className="space-y-5">
      <SectionCard
        title="Links de doação"
        desc="Endereços curtos e rastreáveis que abrem o checkout desta campanha já configurado. Use um por canal (bio, e-mail, evento) para saber de onde vêm as doações."
      >
        {visible.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
            Nenhum link ainda. Crie o primeiro abaixo.
          </p>
        ) : (
          <ul className="space-y-3">
            {visible.map((l) => (
              <li key={l.id}>
                <LinkRow orgId={orgId} publicOrigin={publicOrigin} link={l} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <CreateForm orgId={orgId} campaignId={campaignId} />

      {archived.length > 0 && (
        <SectionCard title="Arquivados" desc="Não recebem mais visitas. Podem ser reativados.">
          <ul className="space-y-3">
            {archived.map((l) => (
              <li key={l.id}>
                <LinkRow orgId={orgId} publicOrigin={publicOrigin} link={l} />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

/* ── One link ────────────────────────────────────────────────────── */

function LinkRow({
  orgId,
  publicOrigin,
  link,
}: {
  orgId: string;
  publicOrigin: string;
  link: LinkValues;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [state, action, saving] = useActionState<ActionResult | null, FormData>(
    updateDonationLink.bind(null, orgId, link.id),
    null,
  );
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  useEffect(() => {
    if (state?.ok) {
      setEditing(false);
      router.refresh();
    }
  }, [state, router]);

  const url = `${publicOrigin}/l/${link.slug}`;
  const conversion = link.visits > 0 ? Math.round((link.donationsCount / link.visits) * 100) : 0;

  function changeStatus(status: LinkStatus) {
    startTransition(async () => {
      await setDonationLinkStatus(orgId, link.id, status);
      router.refresh();
    });
  }
  function remove() {
    if (!confirm("Excluir este link? As doações já recebidas por ele continuam registradas.")) return;
    startTransition(async () => {
      await deleteDonationLink(orgId, link.id);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{link.title}</span>
            <Badge tone={STATUS[link.status].tone}>{STATUS[link.status].label}</Badge>
          </div>
          {link.note && <p className="mt-0.5 text-xs text-muted">{link.note}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-xs">
          <a href={url} target="_blank" rel="noreferrer" className="link">
            Abrir
          </a>
          <span className="text-line-strong">·</span>
          <a href={`/api/panel/orgs/${orgId}/links/${link.id}/qr`} target="_blank" rel="noreferrer" className="link">
            QR
          </a>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-canvas px-2.5 py-1.5 text-xs text-ink">{url}</code>
        <CopyButton value={url} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Metric label="Visitas" value={link.visits.toLocaleString("pt-BR")} />
        <Metric label="Doações" value={link.donationsCount.toLocaleString("pt-BR")} />
        <Metric label="Arrecadado" value={brl(link.raisedCents)} />
        <Metric label="Conversão" value={`${conversion}%`} />
      </dl>

      {(link.amountReais || link.lockAmount || link.defaultRecurring || link.defaultCoverFee || link.expiresAt) && (
        <p className="mt-2.5 text-xs text-muted">
          {link.amountReais && <>Valor {link.lockAmount ? "fixo" : "sugerido"} R$ {link.amountReais}. </>}
          {link.defaultRecurring && <>Já vem mensal. </>}
          {link.defaultCoverFee && <>Cobre a taxa por padrão. </>}
          {link.expiresAt && <>Expira em {new Date(link.expiresAt).toLocaleString("pt-BR")}. </>}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => setEditing((v) => !v)}>
          {editing ? "Fechar" : "Editar"}
        </Button>
        {link.status === "ACTIVE" ? (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => changeStatus("PAUSED")}>
            Pausar
          </Button>
        ) : (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => changeStatus("ACTIVE")}>
            Reativar
          </Button>
        )}
        {link.status === "ARCHIVED" ? (
          <button type="button" onClick={remove} disabled={pending} className="text-xs font-medium text-danger hover:underline">
            Excluir
          </button>
        ) : (
          <button
            type="button"
            onClick={() => changeStatus("ARCHIVED")}
            disabled={pending}
            className="text-xs font-medium text-muted hover:text-ink hover:underline"
          >
            Arquivar
          </button>
        )}
      </div>

      {editing && (
        <form action={action} className="mt-4 space-y-3.5 border-t border-line pt-4">
          <LinkFields initial={link} err={err} />
          <SaveBar state={state} pending={saving} />
        </form>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
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
          /* clipboard blocked — the URL is still selectable */
        }
      }}
    >
      {copied ? "Copiado!" : "Copiar"}
    </Button>
  );
}

/* ── Create ──────────────────────────────────────────────────────── */

function CreateForm({ orgId, campaignId }: { orgId: string; campaignId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createDonationLink.bind(null, orgId, campaignId),
    null,
  );
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (state?.ok) {
      setNonce((n) => n + 1); // reset the uncontrolled fields
      router.refresh();
    }
  }, [state, router]);

  return (
    <SectionCard title="Novo link" desc="O endereço curto é gerado automaticamente.">
      <form key={nonce} action={action} className="space-y-3.5">
        <LinkFields err={err} />
        <SaveBar state={state} pending={pending} />
      </form>
    </SectionCard>
  );
}

/* ── Shared fields ───────────────────────────────────────────────── */

function LinkFields({
  initial,
  err,
}: {
  initial?: LinkValues;
  err: (k: string) => string | undefined;
}) {
  const [showUtm, setShowUtm] = useState(
    Boolean(initial && (initial.utmSource || initial.utmMedium || initial.utmCampaign || initial.utmContent || initial.utmTerm)),
  );

  return (
    <>
      <Field label="Nome do link" error={err("title")} hint="Só você vê. Ex.: “Bio do Instagram”, “Lista de e-mail — março”.">
        <Input name="title" defaultValue={initial?.title} maxLength={80} required />
      </Field>
      <Field label="Observação" error={err("note")} hint="Opcional.">
        <Input name="note" defaultValue={initial?.note} maxLength={280} />
      </Field>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Valor (R$)" error={err("amountReais")} hint="Abre o checkout com este valor. Opcional.">
          <Input name="amountReais" defaultValue={initial?.amountReais} inputMode="decimal" placeholder="50,00" />
        </Field>
        <Field label="Expira em" error={err("expiresAt")} hint="Depois disso o link vira um link comum, sem rastreio.">
          <Input name="expiresAt" type="datetime-local" defaultValue={initial?.expiresAt} />
        </Field>
      </div>

      <Field label="Valores sugeridos (R$)" hint="Substituem os da campanha só neste link. Separe por vírgula.">
        <Input name="suggestedAmountsReais" defaultValue={initial?.suggestedAmountsReais} placeholder="25, 50, 100" />
      </Field>

      <div className="space-y-2">
        <Checkbox
          name="lockAmount"
          value="true"
          defaultChecked={initial?.lockAmount}
          label="Travar o valor (o doador não pode alterar) — precisa de um valor definido acima"
        />
        <Checkbox
          name="defaultRecurring"
          value="true"
          defaultChecked={initial?.defaultRecurring}
          label="Já vir marcado como doação mensal"
        />
        <Checkbox
          name="defaultCoverFee"
          value="true"
          defaultChecked={initial?.defaultCoverFee}
          label="Já vir marcado “cobrir a taxa da plataforma”"
        />
      </div>

      <div className="rounded-lg border border-line">
        <button
          type="button"
          onClick={() => setShowUtm((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
        >
          Rastreamento (UTM)
          <span className="text-xs text-muted">{showUtm ? "ocultar" : "mostrar"}</span>
        </button>
        <div className={cn("grid gap-3 px-3 pb-3 sm:grid-cols-2", showUtm ? "" : "hidden")}>
          <UtmField name="utmSource" label="utm_source" placeholder="instagram" value={initial?.utmSource} />
          <UtmField name="utmMedium" label="utm_medium" placeholder="bio" value={initial?.utmMedium} />
          <UtmField name="utmCampaign" label="utm_campaign" placeholder="dia-das-maes" value={initial?.utmCampaign} />
          <UtmField name="utmContent" label="utm_content" placeholder="story-1" value={initial?.utmContent} />
          <UtmField name="utmTerm" label="utm_term" placeholder="" value={initial?.utmTerm} />
        </div>
      </div>
    </>
  );
}

function UtmField({
  name,
  label,
  placeholder,
  value,
}: {
  name: string;
  label: string;
  placeholder: string;
  value?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="label font-mono text-xs">{label}</span>
      <Input name={name} defaultValue={value} placeholder={placeholder} maxLength={120} />
    </label>
  );
}
