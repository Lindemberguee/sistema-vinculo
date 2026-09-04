"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  inviteMember,
  changeMemberRole,
  removeMember,
  revokeInvitation,
  resendInvitation,
  type TeamResult,
} from "@/server/team/actions";
import { Field, Input, Select, Button, Badge, Card, CardBody } from "@/components/ui";

const ROLES = ["OWNER", "ADMIN", "FINANCE", "EDITOR", "VIEWER"] as const;
type Role = (typeof ROLES)[number];
const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  FINANCE: "Financeiro",
  EDITOR: "Editor",
  VIEWER: "Visualizador",
};

interface Member {
  id: string;
  userId: string;
  role: string;
  name: string;
  email: string;
}
interface Invite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

export function TeamManager({
  orgId,
  callerUserId,
  callerRole,
  members,
  invites,
}: {
  orgId: string;
  callerUserId: string;
  callerRole: string;
  members: Member[];
  invites: Invite[];
}) {
  const router = useRouter();
  const isOwner = callerRole === "OWNER";
  const assignableRoles = ROLES.filter((r) => r !== "OWNER" || isOwner);

  const [inviteState, inviteAction, inviting] = useActionState<TeamResult | null, FormData>(
    inviteMember.bind(null, orgId),
    null,
  );
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (inviteState?.ok) {
      setNonce((n) => n + 1); // reset the uncontrolled form
      router.refresh(); // pull the new pending invite into the list
    }
  }, [inviteState, router]);

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold">Convidar alguém</h2>
          <form key={nonce} action={inviteAction} className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <Field label="E-mail" error={inviteState?.fieldErrors?.email?.[0]}>
              <Input name="email" type="email" required placeholder="pessoa@exemplo.com" />
            </Field>
            <Field label="Função">
              <Select name="role" defaultValue="EDITOR">
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" disabled={inviting}>
              {inviting ? "Enviando…" : "Enviar convite"}
            </Button>
          </form>
          {inviteState?.error && <p className="field-error mt-2">{inviteState.error}</p>}
          {inviteState?.ok && <p className="mt-2 text-sm text-success">Convite enviado.</p>}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold">Integrantes</h2>
          <ul className="mt-3 divide-y divide-line">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                orgId={orgId}
                m={m}
                isSelf={m.userId === callerUserId}
                canManage={m.userId !== callerUserId && (m.role !== "OWNER" || isOwner)}
                assignableRoles={assignableRoles}
              />
            ))}
          </ul>
        </CardBody>
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold">Convites pendentes</h2>
            <ul className="mt-3 divide-y divide-line">
              {invites.map((i) => (
                <InviteRow key={i.id} orgId={orgId} i={i} />
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function MemberRow({
  orgId,
  m,
  isSelf,
  canManage,
  assignableRoles,
}: {
  orgId: string;
  m: Member;
  isSelf: boolean;
  canManage: boolean;
  assignableRoles: readonly Role[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<TeamResult>) {
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Não foi possível concluir.");
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{m.name}</span>
          {isSelf && <Badge tone="neutral">você</Badge>}
        </div>
        <div className="truncate text-xs text-muted">{m.email}</div>
        {error && <div className="field-error mt-0.5">{error}</div>}
      </div>
      {canManage ? (
        <>
          <select
            className="input h-8 w-auto py-0 text-xs"
            defaultValue={m.role}
            disabled={pending}
            onChange={(e) => run(() => changeMemberRole(orgId, m.id, e.target.value as Role))}
          >
            {[...new Set([m.role as Role, ...assignableRoles])].map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r as Role] ?? r}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(`Remover ${m.name} da equipe?`)) run(() => removeMember(orgId, m.id));
            }}
            className="text-xs font-medium text-danger hover:underline"
          >
            Remover
          </button>
        </>
      ) : (
        <span className="text-xs text-muted">{ROLE_LABEL[m.role as Role] ?? m.role}</span>
      )}
    </li>
  );
}

function InviteRow({ orgId, i }: { orgId: string; i: Invite }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<TeamResult>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{i.email}</div>
        <div className="text-xs text-muted">
          {ROLE_LABEL[i.role as Role] ?? i.role} · expira em {i.expiresAt}
        </div>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => resendInvitation(orgId, i.id))}
        className="text-xs font-medium text-brand-600 hover:underline"
      >
        Reenviar
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => revokeInvitation(orgId, i.id))}
        className="text-xs font-medium text-muted hover:text-danger hover:underline"
      >
        Revogar
      </button>
    </li>
  );
}
