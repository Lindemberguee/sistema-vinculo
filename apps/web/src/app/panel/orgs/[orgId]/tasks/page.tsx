import Link from "next/link";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { getOrgTasks } from "@/server/crm/tasks-queries";
import { TaskBoard } from "@/components/crm/TaskBoard";
import { PageHeader, cn } from "@/components/ui";

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  const { db, userId } = await requireOrgAccessPage(orgId, "VIEWER");

  const rawAssignee = Array.isArray(sp.assignee) ? sp.assignee[0] : sp.assignee;
  const members = await db.membership.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "asc" },
    select: { userId: true, user: { select: { name: true } } },
  });

  const assigneeUserId =
    rawAssignee === "me" ? userId : members.some((m) => m.userId === rawAssignee) ? rawAssignee : undefined;

  const data = await getOrgTasks(db, orgId, assigneeUserId ? { assigneeUserId } : {});

  const chips: { key: string; label: string }[] = [
    { key: "", label: "Todas" },
    { key: "me", label: "Minhas" },
    ...members.filter((m) => m.userId !== userId).map((m) => ({ key: m.userId, label: m.user.name })),
  ];
  const active = rawAssignee ?? "";

  return (
    <>
      <PageHeader
        title="Tarefas"
        description="Follow-ups do relacionamento com doadores. Crie tarefas na página de cada doador."
        back={{ href: `/orgs/${orgId}`, label: "Painel" }}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">Responsável</span>
        {chips.map((c) => (
          <Link
            key={c.key || "all"}
            href={c.key ? `?assignee=${c.key}` : "?"}
            aria-current={c.key === active ? "true" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              c.key === active
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-line-strong text-muted hover:border-muted/40 hover:text-ink",
            )}
          >
            {c.label}
          </Link>
        ))}
        <span className="ml-auto text-xs text-muted">{data.openCount} abertas</span>
      </div>

      <TaskBoard orgId={orgId} data={data} />
    </>
  );
}
