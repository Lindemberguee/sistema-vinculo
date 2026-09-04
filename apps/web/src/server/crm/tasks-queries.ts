import "server-only";
import type { requireOrgAccess } from "@/server/auth-helpers";

type Db = Awaited<ReturnType<typeof requireOrgAccess>>["db"];

export interface OrgTaskRow {
  id: string;
  title: string;
  details: string | null;
  dueAt: Date | null;
  doneAt: Date | null;
  donor: { id: string; name: string };
  assignee: { id: string; name: string } | null;
}

export interface OrgTasksResult {
  overdue: OrgTaskRow[];
  today: OrgTaskRow[];
  upcoming: OrgTaskRow[];
  noDate: OrgTaskRow[];
  done: OrgTaskRow[];
  openCount: number;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Follow-up board for the org. `assigneeUserId` filters to one person's tasks;
 * "me" is resolved by the caller. Open tasks are bucketed by due date; the most
 * recent 20 completed tasks are returned for reference.
 */
export async function getOrgTasks(
  db: Db,
  organizationId: string,
  opts: { assigneeUserId?: string } = {},
): Promise<OrgTasksResult> {
  const assignee = opts.assigneeUserId ? { assigneeUserId: opts.assigneeUserId } : {};

  const [open, done] = await Promise.all([
    db.donorTask.findMany({
      where: { organizationId, doneAt: null, ...assignee },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        details: true,
        dueAt: true,
        doneAt: true,
        donor: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    }),
    db.donorTask.findMany({
      where: { organizationId, doneAt: { not: null }, ...assignee },
      orderBy: { doneAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        details: true,
        dueAt: true,
        doneAt: true,
        donor: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    }),
  ]);

  const t0 = startOfToday();
  const t1 = endOfToday();
  const res: OrgTasksResult = { overdue: [], today: [], upcoming: [], noDate: [], done, openCount: open.length };

  for (const task of open) {
    if (!task.dueAt) res.noDate.push(task);
    else if (task.dueAt < t0) res.overdue.push(task);
    else if (task.dueAt <= t1) res.today.push(task);
    else res.upcoming.push(task);
  }

  return res;
}
