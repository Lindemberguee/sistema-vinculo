"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  createCampaignReward,
  updateCampaignReward,
  deleteCampaignReward,
  type ActionResult,
} from "@/server/campaigns/actions";
import { Field, Input, Textarea, Button } from "@/components/ui";
import { SectionCard, SaveBar } from "./EssentialTab";

export interface RewardValues {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  amountReais: string;
  quantity: string;
  claimed: number;
}

export function RewardsTab({
  orgId,
  campaignId,
  rewards,
}: {
  orgId: string;
  campaignId: string;
  rewards: RewardValues[];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createCampaignReward.bind(null, orgId, campaignId),
    null,
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Cotas são faixas de doação com uma recompensa ou impacto tangível. Opcional.
      </p>

      {rewards.map((r) => (
        <RewardRow key={r.id} orgId={orgId} reward={r} />
      ))}

      <form action={action}>
        <SectionCard title="Nova cota" desc="Título, valor e (opcional) uma quantidade limitada.">
          <RewardFields state={state} />
          <SaveBar state={state} pending={pending} />
        </SectionCard>
      </form>
    </div>
  );
}

function RewardRow({ orgId, reward }: { orgId: string; reward: RewardValues }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateCampaignReward.bind(null, orgId, reward.id),
    null,
  );
  const [deleting, startDelete] = useTransition();
  const router = useRouter();

  return (
    <form action={action}>
      <SectionCard
        title={reward.title || "Cota"}
        desc={reward.claimed > 0 ? `${reward.claimed} já resgatadas` : undefined}
      >
        <RewardFields state={state} initial={reward} />
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
          {state?.ok && <span className="text-sm text-success">Salvo.</span>}
          {state?.error && <span className="field-error">{state.error}</span>}
          <button
            type="button"
            disabled={deleting}
            onClick={() =>
              startDelete(async () => {
                await deleteCampaignReward(orgId, reward.id);
                router.refresh();
              })
            }
            className="ml-auto flex items-center gap-1 text-xs font-medium text-danger hover:underline disabled:opacity-40"
          >
            <Trash2 className="size-3.5" /> Remover cota
          </button>
        </div>
      </SectionCard>
    </form>
  );
}

function RewardFields({ state, initial }: { state: ActionResult | null; initial?: RewardValues }) {
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];
  return (
    <>
      <Field label="Título" error={err("title")}>
        <Input name="title" defaultValue={initial?.title ?? ""} maxLength={120} required />
      </Field>
      <Field label="Descrição" error={err("description")} hint="O que o doador recebe ou o que essa cota financia.">
        <Textarea name="description" defaultValue={initial?.description ?? ""} rows={2} maxLength={600} />
      </Field>
      <div className="grid gap-3.5 sm:grid-cols-3">
        <Field label="Valor (R$)" error={err("amountReais")}>
          <Input name="amountReais" defaultValue={initial?.amountReais ?? ""} inputMode="decimal" required />
        </Field>
        <Field label="Quantidade" error={err("quantity")} hint="Vazio = ilimitada.">
          <Input name="quantity" defaultValue={initial?.quantity ?? ""} inputMode="numeric" />
        </Field>
        <Field label="Imagem (URL)" error={err("imageUrl")}>
          <Input name="imageUrl" type="url" defaultValue={initial?.imageUrl ?? ""} />
        </Field>
      </div>
    </>
  );
}
