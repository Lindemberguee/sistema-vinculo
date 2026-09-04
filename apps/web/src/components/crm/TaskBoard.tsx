"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckSquare, Square, Trash2 } from "lucide-react";
import { deleteDonorTask, toggleDonorTaskDone } from "@/server/crm/tasks";
import type { OrgTaskRow, OrgTasksResult } from "@/server/crm/tasks-queries";
import { cn } from "@/components/ui";

const BUCKETS: { key: keyof OrgTasksResult; label: string; tone: string }[] = [
  { key: "overdue", label: "Atrasadas", tone: "text-danger" },
  { key: "today", label: "Hoje", tone: "text-warn" },
  { key: "upcoming", label: "Próximas", tone: "text-ink" },
  { key: "noDate", label: "Sem prazo", tone: "text-muted" },
  { key: "done", label: "Concluídas recentemente", tone: "text-muted" },
];

export function TaskBoard({ orgId, data }: { orgId: string; data: OrgTasksResult }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const act = async (id: string, fn: () => Promise<{ ok: boolean }>) => {
    setBusyId(id);
    await fn();
    setBusyId(null);
    router.refresh();
  };

  const empty = data.openCount === 0 && data.done.length === 0;
  if (empty) {
    return (
      <p className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center text-sm text-muted">
        Nenhuma tarefa. Crie follow-ups na página de um doador.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {BUCKETS.map(({ key, label, tone }) => {
        const rows = data[key] as OrgTaskRow[];
        if (rows.length === 0) return null;
        return (
          <section key={key}>
            <h2 className={cn("eyebrow mb-2", tone)}>
              {label} · {rows.length}
            </h2>
            <div className="card divide-y divide-line overflow-hidden">
              {rows.map((t) => {
                const overdue = key === "overdue";
                return (
                  <div key={t.id} className="group flex items-start gap-3 px-4 py-3">
                    <button
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => act(t.id, () => toggleDonorTaskDone(orgId, t.id))}
                      aria-label={t.doneAt ? "Reabrir" : "Concluir"}
                      className={cn(
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded",
                        t.doneAt ? "text-success" : "text-faint hover:text-brand-600",
                      )}
                    >
                      {t.doneAt ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm", t.doneAt && "text-muted line-through")}>{t.title}</p>
                      {t.details && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{t.details}</p>}
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-faint">
                        <Link href={`/orgs/${orgId}/donors/${t.donor.id}`} className="text-brand-600 hover:underline">
                          {t.donor.name}
                        </Link>
                        {t.assignee && <span>· {t.assignee.name}</span>}
                        {t.dueAt && (
                          <span className={cn(overdue && "font-medium text-danger")}>
                            · {t.doneAt ? "era " : ""}
                            {t.dueAt.toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        {t.doneAt && <span>· concluída {t.doneAt.toLocaleDateString("pt-BR")}</span>}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => act(t.id, () => deleteDonorTask(orgId, t.id))}
                      aria-label="Excluir tarefa"
                      className="grid size-6 shrink-0 place-items-center rounded text-faint opacity-0 transition-opacity hover:bg-canvas hover:text-danger group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
