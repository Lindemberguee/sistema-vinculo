"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  saveCampaignCommunication,
  createCampaignUpdate,
  deleteCampaignUpdate,
  type ActionResult,
} from "@/server/campaigns/actions";
import { Field, Input, Checkbox, Button } from "@/components/ui";
import { StoryEditor } from "@/components/StoryEditor";
import { KeyValueListInput } from "@/components/KeyValueListInput";
import { SectionCard, SaveBar } from "./EssentialTab";

export interface CommunicationValues {
  faq: { q: string; a: string }[];
  showFaq: boolean;
  showUpdates: boolean;
  updates: { id: string; title: string; publishedAt: string; notified: boolean }[];
}

export function CommunicationTab({
  orgId,
  campaignId,
  initial,
}: {
  orgId: string;
  campaignId: string;
  initial: CommunicationValues;
}) {
  const [commState, commAction, commPending] = useActionState<ActionResult | null, FormData>(
    saveCampaignCommunication.bind(null, orgId, campaignId),
    null,
  );
  const [newState, newAction, newPending] = useActionState<ActionResult | null, FormData>(
    createCampaignUpdate.bind(null, orgId, campaignId),
    null,
  );

  return (
    <div className="space-y-5">
      <form action={commAction} className="space-y-5">
        <SectionCard title="FAQ" desc="Tire as dúvidas mais comuns dos doadores.">
          <KeyValueListInput name="faq" defaultValue={initial.faq} />
          <Checkbox name="showFaq" value="true" defaultChecked={initial.showFaq} label="Mostrar a FAQ na página" />
          <Checkbox
            name="showUpdates"
            value="true"
            defaultChecked={initial.showUpdates}
            label="Mostrar as novidades na página"
          />
        </SectionCard>
        <SaveBar state={commState} pending={commPending} />
      </form>

      <SectionCard title="Novidades" desc="Mantenha os doadores informados sobre a campanha.">
        {initial.updates.length > 0 && (
          <ul className="divide-y divide-line">
            {initial.updates.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{u.title}</span>
                  <span className="text-xs text-muted">
                    {u.publishedAt}
                    {u.notified ? " · doadores avisados" : ""}
                  </span>
                </span>
                <DeleteUpdate orgId={orgId} updateId={u.id} />
              </li>
            ))}
          </ul>
        )}

        <form action={newAction} className="mt-2 space-y-3 rounded-lg border border-line p-3">
          <Field label="Título" error={newState?.fieldErrors?.title?.[0]}>
            <Input name="title" maxLength={160} required />
          </Field>
          <Field label="Texto" error={newState?.fieldErrors?.body?.[0]}>
            <StoryEditor name="body" defaultValue="" />
          </Field>
          <Checkbox
            name="notify"
            value="true"
            defaultChecked
            label="Avisar os doadores desta campanha por e-mail"
          />
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={newPending}>
              {newPending ? "Publicando…" : "Publicar novidade"}
            </Button>
            {newState?.ok && <span className="text-sm text-success">Publicada.</span>}
            {newState?.error && <span className="field-error">{newState.error}</span>}
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

function DeleteUpdate({ orgId, updateId }: { orgId: string; updateId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Remover novidade"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await deleteCampaignUpdate(orgId, updateId);
          router.refresh();
        })
      }
      className="grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-danger disabled:opacity-40"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
