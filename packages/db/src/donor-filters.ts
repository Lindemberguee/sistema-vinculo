import type { Prisma } from "@prisma/client";

/**
 * Donor list filters — shared so the web list, saved segments and the worker's
 * broadcast fan-out all target exactly the same set of donors.
 */
export interface DonorFilters {
  q?: string;
  segment?: string;
  campaignId?: string;
  tag?: string;
  recurring?: boolean;
  /** Relationship manager (Membership user id), or "none" for unassigned. */
  ownerUserId?: string;
  /** Only donors with at least one unfinished task. */
  hasOpenTask?: boolean;
  /** Predefined "smart list" preset. */
  smart?: SmartListKey;
  /** Quick "VISÕES" preset, mutually exclusive. */
  view?: "recurring" | "oneoff" | "lead";
  minCents?: number;
  sort?: "recent" | "value" | "frequency";
  page?: number;
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

/** Predefined donor filters — one-click lists that matter operationally. */
export const SMART_LISTS = {
  champions: { label: "Campeões", where: (): Prisma.DonorWhereInput => ({ rfmSegment: "Campeões" }) },
  at_risk: {
    label: "Em risco",
    where: (): Prisma.DonorWhereInput => ({ rfmSegment: { in: ["Em risco", "Hibernando", "Atenção"] } }),
  },
  lost: { label: "Perdidos", where: (): Prisma.DonorWhereInput => ({ rfmSegment: "Perdidos" }) },
  new_30d: {
    label: "Novos (30 dias)",
    where: (): Prisma.DonorWhereInput => ({ firstDonationAt: { gte: daysAgo(30) } }),
  },
  recurring_failing: {
    label: "Recorrente com falha",
    where: (): Prisma.DonorWhereInput => ({ recurring: { some: { status: "PAST_DUE" } } }),
  },
  big_donors: {
    label: "Grandes doadores",
    where: (): Prisma.DonorWhereInput => ({ totalDonatedCents: { gte: 100_000 } }),
  },
} as const;
export type SmartListKey = keyof typeof SMART_LISTS;
export const SMART_LIST_KEYS = Object.keys(SMART_LISTS) as SmartListKey[];

/** A record of raw query-param strings → typed filters. */
export function parseDonorFilters(sp: Record<string, string | string[] | undefined>): DonorFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  const minReais = Number(one("minReais"));
  return {
    q: one("q")?.trim() || undefined,
    segment: one("segment") || undefined,
    campaignId: one("campaignId") || undefined,
    tag: one("tag") || undefined,
    recurring: one("recurring") === "1",
    ownerUserId: one("owner") || undefined,
    hasOpenTask: one("task") === "1",
    smart: SMART_LIST_KEYS.includes(one("smart") as never) ? (one("smart") as SmartListKey) : undefined,
    view: (["recurring", "oneoff", "lead"] as const).includes(one("view") as never)
      ? (one("view") as DonorFilters["view"])
      : undefined,
    minCents: Number.isFinite(minReais) && minReais > 0 ? Math.round(minReais * 100) : undefined,
    sort: (["recent", "value", "frequency"] as const).includes(one("sort") as never)
      ? (one("sort") as DonorFilters["sort"])
      : "recent",
    page: Math.max(1, Number(one("page")) || 1),
  };
}

const VIEW_LABEL: Record<NonNullable<DonorFilters["view"]>, string> = {
  recurring: "Recorrentes",
  oneoff: "Pontuais",
  lead: "Leads (sem doação)",
};

/** Human-readable chips describing an active filter set (pt-BR). Pure. */
export function describeDonorFilters(f: DonorFilters): { label: string }[] {
  const out: { label: string }[] = [];
  if (f.smart) out.push({ label: SMART_LISTS[f.smart].label });
  if (f.view) out.push({ label: VIEW_LABEL[f.view] });
  if (f.recurring && !f.view) out.push({ label: "Recorrentes" });
  if (f.segment) out.push({ label: `Segmento RFM: ${f.segment}` });
  if (f.campaignId) out.push({ label: "Doou para uma campanha" });
  if (f.tag) out.push({ label: `Tag: ${f.tag}` });
  if (f.minCents) out.push({ label: `Total ≥ R$ ${(f.minCents / 100).toFixed(2).replace(".", ",")}` });
  if (f.ownerUserId === "none") out.push({ label: "Sem responsável" });
  else if (f.ownerUserId) out.push({ label: "Responsável definido" });
  if (f.hasOpenTask) out.push({ label: "Com tarefa aberta" });
  if (f.q) out.push({ label: `Busca: "${f.q}"` });
  if (out.length === 0) out.push({ label: "Todos os doadores" });
  return out;
}

export function buildDonorWhere(organizationId: string, f: DonorFilters): Prisma.DonorWhereInput {
  return {
    organizationId,
    ...(f.q
      ? { OR: [{ name: { contains: f.q, mode: "insensitive" } }, { email: { contains: f.q, mode: "insensitive" } }] }
      : {}),
    ...(f.segment ? { rfmSegment: f.segment } : {}),
    ...(f.tag ? { tags: { some: { tag: f.tag } } } : {}),
    ...(f.campaignId ? { donations: { some: { campaignId: f.campaignId, status: "PAID" } } } : {}),
    ...(f.recurring || f.view === "recurring" ? { recurring: { some: { status: "ACTIVE" } } } : {}),
    ...(f.view === "oneoff" ? { donationsCount: { gt: 0 }, recurring: { none: { status: "ACTIVE" } } } : {}),
    ...(f.view === "lead" ? { donationsCount: 0 } : {}),
    ...(f.minCents ? { totalDonatedCents: { gte: f.minCents } } : {}),
    ...(f.ownerUserId === "none"
      ? { ownerUserId: null }
      : f.ownerUserId
        ? { ownerUserId: f.ownerUserId }
        : {}),
    ...(f.hasOpenTask ? { tasks: { some: { doneAt: null } } } : {}),
    ...(f.smart ? SMART_LISTS[f.smart].where() : {}),
  };
}
