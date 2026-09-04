import "server-only";
import { formatBRL } from "@donation/shared";
import type { requireOrgAccess } from "@/server/auth-helpers";

type Db = Awaited<ReturnType<typeof requireOrgAccess>>["db"];

export type TimelineKind =
  | "note"
  | "call"
  | "email"
  | "meeting"
  | "whatsapp"
  | "other"
  | "donation"
  | "donation_failed"
  | "donation_refunded"
  | "recurring_started"
  | "recurring_canceled"
  | "email_sent"
  | "task_created"
  | "task_done";

export interface TimelineItem {
  id: string;
  at: Date;
  kind: TimelineKind;
  title: string;
  detail?: string | null;
  by?: string | null;
  /** Manual notes only — enables pin/delete controls. */
  noteId?: string;
  pinned?: boolean;
  /** Task rows — enables the done toggle. */
  taskId?: string;
  taskDone?: boolean;
}

const NOTE_KIND: Record<string, { kind: TimelineKind; label: string }> = {
  NOTE: { kind: "note", label: "Nota" },
  CALL: { kind: "call", label: "Ligação" },
  EMAIL: { kind: "email", label: "E-mail" },
  MEETING: { kind: "meeting", label: "Reunião" },
  WHATSAPP: { kind: "whatsapp", label: "WhatsApp" },
  OTHER: { kind: "other", label: "Contato" },
};

const EMAIL_KIND_LABEL: Record<string, string> = {
  welcome: "Boas-vindas",
  winback: "Reconquista",
  recurring_reminder: "Lembrete de recorrência",
  "campaign-update": "Novidade da campanha",
  "raffle-result": "Resultado da rifa",
};
function emailLabel(kind: string): string {
  const base = kind.split(":")[0]!;
  return EMAIL_KIND_LABEL[base] ?? base.replace(/[-_]/g, " ");
}

/** Merge notes, tasks, donations, recurrences and sent e-mails into one feed (newest first). */
export async function getDonorTimeline(db: Db, organizationId: string, donorId: string): Promise<TimelineItem[]> {
  const [notes, tasks, donations, recurrences, emails] = await Promise.all([
    db.donorNote.findMany({
      where: { organizationId, donorId },
      orderBy: { happenedAt: "desc" },
      select: {
        id: true,
        kind: true,
        body: true,
        happenedAt: true,
        pinned: true,
        createdBy: { select: { name: true } },
      },
    }),
    db.donorTask.findMany({
      where: { organizationId, donorId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        details: true,
        dueAt: true,
        doneAt: true,
        createdAt: true,
        createdBy: { select: { name: true } },
        assignee: { select: { name: true } },
      },
    }),
    db.donation.findMany({
      where: { donorId, status: { in: ["PAID", "FAILED", "EXPIRED", "REFUNDED", "CHARGED_BACK"] } },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        status: true,
        amountCents: true,
        tipCents: true,
        method: true,
        createdAt: true,
        paidAt: true,
        refundedAt: true,
        campaign: { select: { title: true } },
      },
    }),
    db.recurringPlan.findMany({
      where: { donorId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amountCents: true,
        tipCents: true,
        interval: true,
        createdAt: true,
        canceledAt: true,
        campaign: { select: { title: true } },
      },
    }),
    db.emailLog.findMany({
      where: { organizationId, donorId },
      orderBy: { sentAt: "desc" },
      take: 40,
      select: { id: true, kind: true, sentAt: true },
    }),
  ]);

  // Resolve broadcast subjects so the feed shows the real headline, not "campanha".
  const broadcastIds = [
    ...new Set(
      emails
        .filter((e) => e.kind.startsWith("broadcast:"))
        .map((e) => e.kind.slice("broadcast:".length)),
    ),
  ];
  const broadcastSubject = new Map<string, string>();
  if (broadcastIds.length > 0) {
    const bs = await db.donorBroadcast.findMany({
      where: { id: { in: broadcastIds }, organizationId },
      select: { id: true, subject: true },
    });
    for (const b of bs) broadcastSubject.set(b.id, b.subject);
  }

  const items: TimelineItem[] = [];

  for (const n of notes) {
    const meta = NOTE_KIND[n.kind] ?? NOTE_KIND.OTHER!;
    items.push({
      id: `note:${n.id}`,
      at: n.happenedAt,
      kind: meta.kind,
      title: meta.label,
      detail: n.body,
      by: n.createdBy?.name ?? null,
      noteId: n.id,
      pinned: n.pinned,
    });
  }

  for (const t of tasks) {
    const who = t.assignee?.name ? ` · ${t.assignee.name}` : "";
    items.push({
      id: `task:${t.id}`,
      at: t.createdAt,
      kind: "task_created",
      title: `Tarefa: ${t.title}`,
      detail: [t.details, t.dueAt ? `Prazo ${t.dueAt.toLocaleDateString("pt-BR")}` : null].filter(Boolean).join(" — ") || null,
      by: t.createdBy?.name ? `${t.createdBy.name}${who}` : who.trim() ? who.replace(/^ · /, "") : null,
      taskId: t.id,
      taskDone: Boolean(t.doneAt),
    });
    if (t.doneAt) {
      items.push({
        id: `taskdone:${t.id}`,
        at: t.doneAt,
        kind: "task_done",
        title: `Tarefa concluída: ${t.title}`,
      });
    }
  }

  for (const d of donations) {
    const total = formatBRL(d.amountCents + d.tipCents);
    const camp = d.campaign?.title ? ` · ${d.campaign.title}` : "";
    if (d.status === "PAID") {
      items.push({
        id: `don:${d.id}`,
        at: d.paidAt ?? d.createdAt,
        kind: "donation",
        title: `Doação de ${total}${camp}`,
        detail: d.method,
      });
    } else if (d.status === "REFUNDED" || d.status === "CHARGED_BACK") {
      items.push({
        id: `donref:${d.id}`,
        at: d.refundedAt ?? d.createdAt,
        kind: "donation_refunded",
        title: `${d.status === "REFUNDED" ? "Estorno" : "Chargeback"} de ${total}${camp}`,
      });
    } else {
      items.push({
        id: `donfail:${d.id}`,
        at: d.createdAt,
        kind: "donation_failed",
        title: `Doação não concluída (${total})${camp}`,
        detail: d.method,
      });
    }
  }

  for (const r of recurrences) {
    const total = formatBRL(r.amountCents + r.tipCents);
    const every = r.interval === "YEARLY" ? "ano" : "mês";
    const camp = r.campaign?.title ? ` · ${r.campaign.title}` : "";
    items.push({
      id: `rec:${r.id}`,
      at: r.createdAt,
      kind: "recurring_started",
      title: `Assinatura de ${total}/${every} iniciada${camp}`,
    });
    if (r.canceledAt) {
      items.push({
        id: `reccancel:${r.id}`,
        at: r.canceledAt,
        kind: "recurring_canceled",
        title: `Assinatura cancelada${camp}`,
      });
    }
  }

  for (const e of emails) {
    const subject = e.kind.startsWith("broadcast:")
      ? broadcastSubject.get(e.kind.slice("broadcast:".length))
      : undefined;
    items.push({
      id: `mail:${e.id}`,
      at: e.sentAt,
      kind: "email_sent",
      title: subject ? `E-mail: "${subject}"` : `E-mail enviado: ${emailLabel(e.kind)}`,
    });
  }

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items;
}
