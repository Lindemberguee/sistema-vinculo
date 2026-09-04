"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  StickyNote,
  Phone,
  Mail,
  Users,
  MessageCircle,
  MessageSquare,
  Gift,
  RefreshCw,
  XCircle,
  Ban,
  Send,
  CheckSquare,
  Square,
  Pin,
  Trash2,
} from "lucide-react";
import { addDonorNote, deleteDonorNote, toggleDonorNotePinned } from "@/server/crm/notes";
import { createDonorTask, deleteDonorTask, toggleDonorTaskDone } from "@/server/crm/tasks";
import type { TimelineItem, TimelineKind } from "@/server/crm/timeline";
import { Field, Input, Textarea, Select, Button, cn } from "@/components/ui";

const ICON: Record<TimelineKind, { Icon: typeof StickyNote; tone: string }> = {
  note: { Icon: StickyNote, tone: "text-muted bg-canvas" },
  call: { Icon: Phone, tone: "text-brand-700 bg-brand-50" },
  email: { Icon: Mail, tone: "text-brand-700 bg-brand-50" },
  meeting: { Icon: Users, tone: "text-brand-700 bg-brand-50" },
  whatsapp: { Icon: MessageCircle, tone: "text-brand-700 bg-brand-50" },
  other: { Icon: MessageSquare, tone: "text-muted bg-canvas" },
  donation: { Icon: Gift, tone: "text-success bg-success-bg" },
  donation_failed: { Icon: Ban, tone: "text-warn bg-warn-bg" },
  donation_refunded: { Icon: XCircle, tone: "text-danger bg-danger-bg" },
  recurring_started: { Icon: RefreshCw, tone: "text-success bg-success-bg" },
  recurring_canceled: { Icon: XCircle, tone: "text-muted bg-canvas" },
  email_sent: { Icon: Send, tone: "text-muted bg-canvas" },
  task_created: { Icon: Square, tone: "text-accent-600 bg-canvas" },
  task_done: { Icon: CheckSquare, tone: "text-success bg-success-bg" },
};

function when(d: Date): string {
  const diff = Date.now() - d.getTime();
  const day = 86_400_000;
  if (diff < day && new Date().getDate() === d.getDate()) {
    return `hoje ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diff < 7 * day) return `há ${Math.max(1, Math.round(diff / day))} d`;
  return d.toLocaleDateString("pt-BR");
}

export function DonorTimeline({
  orgId,
  donorId,
  items,
  members,
}: {
  orgId: string;
  donorId: string;
  items: TimelineItem[];
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"log" | "task">("log");

  const pinned = items.filter((i) => i.pinned);
  const rest = items.filter((i) => !i.pinned);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 flex gap-1 rounded-lg bg-canvas p-0.5 text-sm">
          {(
            [
              ["log", "Registrar contato"],
              ["task", "Criar tarefa"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 font-medium transition-colors",
                tab === k ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "log" ? (
          <LogForm orgId={orgId} donorId={donorId} onDone={() => router.refresh()} />
        ) : (
          <TaskForm orgId={orgId} donorId={donorId} members={members} onDone={() => router.refresh()} />
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center text-sm text-muted">
          Nenhuma atividade ainda. Registre um contato ou uma tarefa acima.
        </p>
      ) : (
        <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-line">
          {pinned.map((i) => (
            <Row key={i.id} item={i} orgId={orgId} onChanged={() => router.refresh()} />
          ))}
          {rest.map((i) => (
            <Row key={i.id} item={i} orgId={orgId} onChanged={() => router.refresh()} />
          ))}
        </ol>
      )}
    </div>
  );
}

function Row({ item, orgId, onChanged }: { item: TimelineItem; orgId: string; onChanged: () => void }) {
  const { Icon, tone } = ICON[item.kind];
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<{ ok: boolean }>) => {
    setBusy(true);
    await fn();
    setBusy(false);
    onChanged();
  };

  return (
    <li className="group relative flex gap-3 rounded-lg py-2 pl-0 pr-2 hover:bg-canvas/60">
      <span className={cn("z-10 mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", tone)}>
        {item.taskId ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => toggleDonorTaskDone(orgId, item.taskId!))}
            aria-label={item.taskDone ? "Reabrir tarefa" : "Concluir tarefa"}
            className="grid place-items-center"
          >
            {item.taskDone ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
          </button>
        ) : (
          <Icon className="size-4" />
        )}
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm", item.taskDone && "text-muted line-through")}>
            {item.pinned && <Pin className="mr-1 inline size-3 -translate-y-px text-accent-600" />}
            {item.title}
          </p>
          {(item.noteId || item.taskId) && (
            <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {item.noteId && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(() => toggleDonorNotePinned(orgId, item.noteId!))}
                  aria-label={item.pinned ? "Desafixar" : "Fixar"}
                  className="grid size-6 place-items-center rounded text-faint hover:bg-surface hover:text-ink"
                >
                  <Pin className="size-3.5" />
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  act(() => (item.noteId ? deleteDonorNote(orgId, item.noteId) : deleteDonorTask(orgId, item.taskId!)))
                }
                aria-label="Excluir"
                className="grid size-6 place-items-center rounded text-faint hover:bg-surface hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            </span>
          )}
        </div>
        {item.detail && (
          <p className="mt-0.5 whitespace-pre-line text-ui leading-relaxed text-muted">{item.detail}</p>
        )}
        <p className="mt-0.5 text-xs text-faint">
          {when(item.at)}
          {item.by ? ` · ${item.by}` : ""}
        </p>
      </div>
    </li>
  );
}

function LogForm({ orgId, donorId, onDone }: { orgId: string; donorId: string; onDone: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(addDonorNote.bind(null, orgId, donorId), null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      onDone();
    }
  }, [state, onDone]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Field label="Tipo">
          <Select name="kind" defaultValue="NOTE">
            <option value="NOTE">Nota</option>
            <option value="CALL">Ligação</option>
            <option value="EMAIL">E-mail</option>
            <option value="MEETING">Reunião</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="OTHER">Outro</option>
          </Select>
        </Field>
        <Field label="Quando" hint="Deixe em branco para agora.">
          <Input type="datetime-local" name="happenedAt" />
        </Field>
      </div>
      <Field label="Registro">
        <Textarea name="body" rows={3} required placeholder="O que aconteceu ou o que é importante lembrar" />
      </Field>
      {state?.error && <p className="field-error">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Salvando…" : "Adicionar"}
      </Button>
    </form>
  );
}

function TaskForm({
  orgId,
  donorId,
  members,
  onDone,
}: {
  orgId: string;
  donorId: string;
  members: { id: string; name: string }[];
  onDone: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createDonorTask.bind(null, orgId, donorId), null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      onDone();
    }
  }, [state, onDone]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <Field label="Tarefa">
        <Input name="title" required maxLength={200} placeholder="Ex.: ligar para agradecer a doação" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prazo">
          <Input type="date" name="dueAt" />
        </Field>
        <Field label="Responsável" hint="Em branco = você.">
          <Select name="assigneeUserId" defaultValue="">
            <option value="">Eu</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Detalhes" hint="Opcional.">
        <Textarea name="details" rows={2} maxLength={2000} />
      </Field>
      {state?.error && <p className="field-error">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Criando…" : "Criar tarefa"}
      </Button>
    </form>
  );
}
