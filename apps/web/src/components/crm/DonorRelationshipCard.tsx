"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateDonorProfile } from "@/server/crm/donor-profile";
import { Field, Input, Select, Button } from "@/components/ui";

const CHANNEL_LABEL: Record<string, string> = {
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
  PHONE: "Telefone",
  SMS: "SMS",
};

export function DonorRelationshipCard({
  orgId,
  donorId,
  members,
  owner,
  ownerUserId,
  preferredChannel,
  birthdate,
}: {
  orgId: string;
  donorId: string;
  members: { id: string; name: string }[];
  owner: string | null;
  ownerUserId: string | null;
  preferredChannel: string | null;
  birthdate: string | null; // yyyy-mm-dd
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateDonorProfile.bind(null, orgId, donorId), null);

  useEffect(() => {
    if (state?.ok) {
      setEditing(false);
      router.refresh();
    }
  }, [state, router]);

  if (!editing) {
    return (
      <div className="card p-4">
        <div className="flex items-start justify-between">
          <h2 className="text-sm font-semibold">Relacionamento</h2>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Editar
          </button>
        </div>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">Responsável</dt>
            <dd>{owner ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Canal preferido</dt>
            <dd>{preferredChannel ? (CHANNEL_LABEL[preferredChannel] ?? preferredChannel) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Nascimento</dt>
            <dd>{birthdate ? new Date(birthdate).toLocaleDateString("pt-BR") : "—"}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-3 p-4">
      <h2 className="text-sm font-semibold">Relacionamento</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Responsável">
          <Select name="ownerUserId" defaultValue={ownerUserId ?? ""}>
            <option value="">Ninguém</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Canal preferido">
          <Select name="preferredChannel" defaultValue={preferredChannel ?? ""}>
            <option value="">Não definido</option>
            {Object.entries(CHANNEL_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nascimento">
          <Input type="date" name="birthdate" defaultValue={birthdate ?? ""} />
        </Field>
      </div>
      {state?.error && <p className="field-error">{state.error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        <button type="button" onClick={() => setEditing(false)} className="text-sm text-muted hover:text-ink">
          Cancelar
        </button>
      </div>
    </form>
  );
}
