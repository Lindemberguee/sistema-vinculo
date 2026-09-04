"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListChecks, X } from "lucide-react";
import { formatBRL } from "@donation/shared";
import { bulkAddTag, bulkAssignOwner, bulkCreateTask } from "@/server/crm/bulk";
import { Table, Th, Td, Tr, Button, Input, Select, cn } from "@/components/ui";

export interface DonorRow {
  id: string;
  name: string;
  email: string;
  totalDonatedCents: number;
  donationsCount: number;
  lastDonation: string;
  segment: string;
  ownerName: string | null;
  openTasks: number;
  overdue: boolean;
}

function initials(name: string) {
  const p = name.trim().split(/\s+/).slice(0, 2);
  return p.map((x) => x[0]?.toUpperCase() ?? "").join("") || "?";
}

type Mode = null | "owner" | "tag" | "task";

export function DonorResultsTable({
  orgId,
  rows,
  members,
}: {
  orgId: string;
  rows: DonorRow[];
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // form fields for the active bulk action
  const [ownerVal, setOwnerVal] = useState("");
  const [tagVal, setTagVal] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");

  // A selection belongs to the visible result set. Clear it whenever the
  // server sends a different page/filter so bulk actions can never target
  // donors that are no longer on screen.
  useEffect(() => {
    setSelected(new Set());
    setMode(null);
  }, [rows]);

  const ids = useMemo(() => [...selected], [selected]);
  const allChecked = rows.length > 0 && selected.size === rows.length;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  const clear = () => {
    setSelected(new Set());
    setMode(null);
    setMsg(null);
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string; count?: number }>) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      if (r.ok) {
        setMsg({ ok: true, text: `Aplicado a ${r.count ?? ids.length} doador(es).` });
        setSelected(new Set());
        setMode(null);
        setTagVal("");
        setTaskTitle("");
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error ?? "Falha ao aplicar." });
      }
    });

  return (
    <div className="space-y-3">
      <div className="card overflow-hidden">
        <Table>
          <thead>
            <Tr>
              <Th className="w-10">
                <input
                  type="checkbox"
                  className="size-4 accent-brand-600"
                  checked={allChecked}
                  onChange={toggleAll}
                  aria-label="Selecionar todos nesta página"
                />
              </Th>
              <Th>Doador</Th>
              <Th>Responsável</Th>
              <Th>Total</Th>
              <Th>Doações</Th>
              <Th>Última</Th>
              <Th>Segmento</Th>
            </Tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const on = selected.has(d.id);
              return (
                <Tr key={d.id} className={cn(on && "bg-brand-50/50")}>
                  <Td>
                    <input
                      type="checkbox"
                      className="size-4 accent-brand-600"
                      checked={on}
                      onChange={() => toggle(d.id)}
                      aria-label={`Selecionar ${d.name}`}
                    />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-2xs font-semibold text-brand-700">
                        {initials(d.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <Link href={`/orgs/${orgId}/donors/${d.id}`} className="link truncate">
                            {d.name}
                          </Link>
                          {d.openTasks > 0 && (
                            <span
                              className={d.overdue ? "badge-danger" : "badge-warn"}
                              title={`${d.openTasks} tarefa(s) aberta(s)${d.overdue ? " · atrasada" : ""}`}
                            >
                              <ListChecks className="size-3" />
                              {d.openTasks}
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted">{d.email}</span>
                      </span>
                    </div>
                  </Td>
                  <Td className="text-sm">{d.ownerName ?? <span className="text-faint">—</span>}</Td>
                  <Td className="tabular-nums">{formatBRL(d.totalDonatedCents)}</Td>
                  <Td className="tabular-nums">{d.donationsCount}</Td>
                  <Td>{d.lastDonation}</Td>
                  <Td>{d.segment}</Td>
                </Tr>
              );
            })}
            {rows.length === 0 && (
              <Tr>
                <Td colSpan={7} className="text-muted">
                  Nenhum doador para esse filtro.
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </div>

      {selected.size > 0 && (
        <div className="sticky bottom-4 z-10 rounded-xl border border-line bg-surface p-3 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
            <span className="mx-1 h-4 w-px bg-line" />
            {(
              [
                ["owner", "Responsável"],
                ["tag", "Tag"],
                ["task", "Tarefa"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(mode === m ? null : m)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  mode === m
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-line-strong text-muted hover:border-muted/40 hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={clear}
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
            >
              <X className="size-3.5" /> Limpar seleção
            </button>
          </div>

          {mode && (
            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
              {mode === "owner" && (
                <>
                  <label className="grid gap-1 text-xs">
                    <span className="text-muted">Definir responsável</span>
                    <Select value={ownerVal} onChange={(e) => setOwnerVal(e.target.value)} className="w-48">
                      <option value="">Ninguém</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <Button size="sm" disabled={pending} onClick={() => run(() => bulkAssignOwner(orgId, ids, ownerVal))}>
                    Aplicar
                  </Button>
                </>
              )}
              {mode === "tag" && (
                <>
                  <label className="grid gap-1 text-xs">
                    <span className="text-muted">Adicionar tag</span>
                    <Input value={tagVal} onChange={(e) => setTagVal(e.target.value)} maxLength={40} className="w-48" />
                  </label>
                  <Button
                    size="sm"
                    disabled={pending || !tagVal.trim()}
                    onClick={() => run(() => bulkAddTag(orgId, ids, tagVal.trim()))}
                  >
                    Aplicar
                  </Button>
                </>
              )}
              {mode === "task" && (
                <>
                  <label className="grid gap-1 text-xs">
                    <span className="text-muted">Tarefa</span>
                    <Input
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      maxLength={200}
                      placeholder="Ex.: ligar para agradecer"
                      className="w-64"
                    />
                  </label>
                  <label className="grid gap-1 text-xs">
                    <span className="text-muted">Prazo</span>
                    <Input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} className="w-40" />
                  </label>
                  <label className="grid gap-1 text-xs">
                    <span className="text-muted">Responsável</span>
                    <Select
                      value={taskAssignee}
                      onChange={(e) => setTaskAssignee(e.target.value)}
                      className="w-40"
                    >
                      <option value="">Eu</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <Button
                    size="sm"
                    disabled={pending || !taskTitle.trim()}
                    onClick={() =>
                      run(() =>
                        bulkCreateTask(orgId, ids, {
                          title: taskTitle.trim(),
                          dueAt: taskDue || undefined,
                          assigneeUserId: taskAssignee || undefined,
                        }),
                      )
                    }
                  >
                    Criar para {selected.size}
                  </Button>
                </>
              )}
            </div>
          )}
          {msg && (
            <p className={cn("mt-2 text-xs", msg.ok ? "text-success" : "field-error")}>{msg.text}</p>
          )}
        </div>
      )}
    </div>
  );
}
