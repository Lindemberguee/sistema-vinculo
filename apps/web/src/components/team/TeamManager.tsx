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
import { Field, Input, Select, Button, Badge, Card, CardBody, useConfirm } from "@/components/ui";

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
          <form
            key={nonce}
            action={inviteAction}
            className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-start"
          >
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
            <Button type="submit" loading={inviting} className="sm:mt-6">
              {inviting ? "Enviando…" : "Enviar convite"}
            </Button>
          </form>
          {inviteState?.error && (
            <p className="field-error mt-2" role="alert">
              {inviteState.error}
            </p>
          )}
          {inviteState?.ok && (
            <p className="mt-2 text-sm text-success" role="status" aria-live="polite">
              Convite enviado.
            </p>
          )}
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
  const [role, setRole] = useState(m.role);
  const { confirm, dialog } = useConfirm();

  function run(fn: () => Promise<TeamResult>) {
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Não foi possível concluir.");
      router.refresh();
    });
  }

  const roleOptions = [...new Set([m.role as Role, ...assignableRoles])];

  async function onRoleChange(next: string) {
    if (next === m.role) return;
    const ok = await confirm({
      title: `Mudar função de ${m.name}?`,
      description: `De ${ROLE_LABEL[m.role as Role] ?? m.role} para ${ROLE_LABEL[next as Role] ?? next}. O acesso muda na hora.`,
      confirmLabel: "Mudar função",
    });
    if (!ok) {
      setRole(m.role);
      return;
    }
    setRole(next);
    run(() => changeMemberRole(orgId, m.id, next as Role));
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{m.name}</span>
          {isSelf && <Badge tone="neutral">você</Badge>}
        </div>
        <div className="truncate text-xs text-muted">{m.email}</div>
        {error && (
          <div className="field-error mt-0.5" role="alert">
            {error}
          </div>
        )}
      </div>
      {canManage ? (
        <>
          <select
            aria-label={`Função de ${m.name}`}
            className="input input-sm w-auto"
            value={role}
            disabled={pending}
            onChange={(e) => onRoleChange(e.target.value)}
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r as Role] ?? r}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={async () => {
              const ok = await confirm({
                title: `Remover ${m.name} da equipe?`,
                description: "A pessoa perde o acesso a esta organização imediatamente.",
                confirmLabel: "Remover",
                tone: "danger",
              });
              if (ok) run(() => removeMember(orgId, m.id));
            }}
          >
            Remover
          </Button>
        </>
      ) : (
        <span className="text-xs text-muted">{ROLE_LABEL[m.role as Role] ?? m.role}</span>
      )}
      {dialog}
    </li>
  );
}

function InviteRow({ orgId, i }: { orgId: string; i: Invite }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { confirm, dialog } = useConfirm();

  function run(fn: () => Promise<TeamResult>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{i.email}</div>
        <div className="text-xs text-muted">
          {ROLE_LABEL[i.role as Role] ?? i.role} · expira em {i.expiresAt}
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => run(() => resendInvitation(orgId, i.id))}
      >
        Reenviar
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={async () => {
          const ok = await confirm({
            title: "Revogar convite?",
            description: `O link enviado para ${i.email} deixa de funcionar.`,
            confirmLabel: "Revogar",
            tone: "danger",
          });
          if (ok) run(() => revokeInvitation(orgId, i.id));
        }}
      >
        Revogar
      </Button>
      {dialog}
    </li>
  );
}
