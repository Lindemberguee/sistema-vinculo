import "server-only";
import { buildDonorWhere, describeDonorFilters, parseDonorFilters } from "@donation/db";
import { donorBroadcastEmail } from "@donation/emails";
import type { requireOrgAccess } from "@/server/auth-helpers";

type Db = Awaited<ReturnType<typeof requireOrgAccess>>["db"];

const RECIPIENTS_PER_PAGE = 20;
export type RecipientStatus = "QUEUED" | "SENT" | "SKIPPED_SUPPRESSED" | "SKIPPED_DUPLICATE" | "FAILED";

export interface BroadcastRow {
  id: string;
  name: string | null;
  subject: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  skippedCount: number;
  error: string | null;
  createdAt: Date;
  sentAt: Date | null;
  scheduledAt: Date | null;
}

export async function getBroadcasts(db: Db, organizationId: string): Promise<BroadcastRow[]> {
  return db.donorBroadcast.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      subject: true,
      status: true,
      recipientCount: true,
      sentCount: true,
      skippedCount: true,
      error: true,
      createdAt: true,
      sentAt: true,
      scheduledAt: true,
    },
  });
}

/** Count + a few sample names for the compose preview. */
export async function getBroadcastPreview(
  db: Db,
  organizationId: string,
  filters: Record<string, string>,
): Promise<{ recipientCount: number; sample: { name: string; email: string }[] }> {
  const where = {
    ...buildDonorWhere(organizationId, parseDonorFilters(filters)),
    NOT: { consent: { path: ["email"], equals: false } },
  };
  const [recipientCount, sample] = await Promise.all([
    db.donor.count({ where }),
    db.donor.findMany({ where, orderBy: { totalDonatedCents: "desc" }, take: 6, select: { name: true, email: true } }),
  ]);
  return { recipientCount, sample };
}

// ── Broadcast detail ────────────────────────────────────────────────

export interface BroadcastDetail {
  id: string;
  name: string | null;
  subject: string;
  bodyText: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  skippedCount: number;
  error: string | null;
  createdAt: Date;
  sentAt: Date | null;
  scheduledAt: Date | null;
  createdBy: string | null;
  filters: Record<string, string>;
  audience: { label: string }[];
  /** null unless a campaign filter is set and resolves. */
  campaignTitle: string | null;
  /** Counts by BroadcastRecipient.status (present keys only). */
  recipientStats: Partial<Record<RecipientStatus, number>>;
  previewHtml: string;
}

export async function getBroadcastDetail(
  db: Db,
  organizationId: string,
  broadcastId: string,
  orgName: string,
): Promise<BroadcastDetail | null> {
  const b = await db.donorBroadcast.findFirst({
    where: { id: broadcastId, organizationId },
    select: {
      id: true,
      name: true,
      subject: true,
      bodyText: true,
      status: true,
      recipientCount: true,
      sentCount: true,
      skippedCount: true,
      error: true,
      createdAt: true,
      sentAt: true,
      scheduledAt: true,
      filters: true,
      createdBy: { select: { name: true } },
    },
  });
  if (!b) return null;

  const filters = (b.filters ?? {}) as Record<string, string>;
  const parsed = parseDonorFilters(filters);

  const [grouped, campaign] = await Promise.all([
    db.broadcastRecipient.groupBy({
      by: ["status"],
      where: { broadcastId },
      _count: { _all: true },
    }),
    parsed.campaignId
      ? db.campaign.findFirst({ where: { id: parsed.campaignId, organizationId }, select: { title: true } })
      : Promise.resolve(null),
  ]);

  const recipientStats: Partial<Record<RecipientStatus, number>> = {};
  for (const g of grouped) recipientStats[g.status as RecipientStatus] = g._count._all;

  const preview = donorBroadcastEmail({
    donorName: "Maria",
    orgName,
    subject: b.subject,
    bodyText: b.bodyText,
  });

  return {
    id: b.id,
    name: b.name,
    subject: b.subject,
    bodyText: b.bodyText,
    status: b.status,
    recipientCount: b.recipientCount,
    sentCount: b.sentCount,
    skippedCount: b.skippedCount,
    error: b.error,
    createdAt: b.createdAt,
    sentAt: b.sentAt,
    scheduledAt: b.scheduledAt,
    createdBy: b.createdBy?.name ?? null,
    filters,
    audience: describeDonorFilters(parsed),
    campaignTitle: campaign?.title ?? null,
    recipientStats,
    previewHtml: preview.html,
  };
}

export interface RecipientRow {
  donorId: string;
  name: string;
  email: string;
  phone: string | null;
  status: RecipientStatus;
  error: string | null;
  sentAt: Date | null;
  emailHealth: string | null; // BOUNCED | COMPLAINED | UNSUBSCRIBED | null
  rfmSegment: string | null;
  lastDonationAt: Date | null;
}

export async function getBroadcastRecipients(
  db: Db,
  organizationId: string,
  broadcastId: string,
  opts: { status?: RecipientStatus; q?: string; page?: number },
): Promise<{ rows: RecipientRow[]; total: number; page: number; pages: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const where = {
    broadcastId,
    organizationId,
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.q ? { email: { contains: opts.q, mode: "insensitive" as const } } : {}),
  };

  const [total, recips] = await Promise.all([
    db.broadcastRecipient.count({ where }),
    db.broadcastRecipient.findMany({
      where,
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * RECIPIENTS_PER_PAGE,
      take: RECIPIENTS_PER_PAGE,
      select: { donorId: true, email: true, status: true, error: true, sentAt: true },
    }),
  ]);

  const donorIds = recips.map((r) => r.donorId);
  const emails = [...new Set(recips.map((r) => r.email.toLowerCase()))];
  const [donors, health] = await Promise.all([
    donorIds.length
      ? db.donor.findMany({
          where: { id: { in: donorIds } },
          select: { id: true, name: true, phone: true, rfmSegment: true, lastDonationAt: true },
        })
      : Promise.resolve([]),
    emails.length
      ? db.donorEmailStatus.findMany({
          where: { organizationId, email: { in: emails, mode: "insensitive" } },
          select: { email: true, status: true },
        })
      : Promise.resolve([]),
  ]);
  const donorById = new Map(donors.map((d) => [d.id, d]));
  const healthByEmail = new Map(health.map((h) => [h.email.toLowerCase(), h.status]));

  const rows: RecipientRow[] = recips.map((r) => {
    const d = donorById.get(r.donorId);
    return {
      donorId: r.donorId,
      name: d?.name ?? r.email,
      email: r.email,
      phone: d?.phone ?? null,
      status: r.status as RecipientStatus,
      error: r.error,
      sentAt: r.sentAt,
      emailHealth: healthByEmail.get(r.email.toLowerCase()) ?? null,
      rfmSegment: d?.rfmSegment ?? null,
      lastDonationAt: d?.lastDonationAt ?? null,
    };
  });

  return { rows, total, page, pages: Math.max(1, Math.ceil(total / RECIPIENTS_PER_PAGE)) };
}
