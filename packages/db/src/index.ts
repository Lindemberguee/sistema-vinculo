import { PrismaClient, Prisma } from "@prisma/client";

export * from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Neon (serverless Postgres) recycles idle pooled connections; the first query
 * after a recycle fails with P1017 "Server has closed the connection" (also
 * P1001/P1002 on a cold compute). Prisma reconnects on its own, so wrap
 * READ-ONLY aggregate paths (dashboards, list summaries) in this to make the
 * drop invisible instead of 500-ing a panel page. Never wrap writes.
 */
const RETRYABLE_CODES = new Set(["P1017", "P1001", "P1002"]);

export async function withDbRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (!code || !RETRYABLE_CODES.has(code) || attempt === tries - 1) throw err;
      lastErr = err;
      await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/**
 * Row-Level Security toggle. When `DB_RLS=on`, tenantPrisma also pins
 * `app.current_org_id` (a Postgres GUC) around every operation so the RLS
 * policies in `sql/rls.sql` enforce isolation at the database layer — a second
 * line of defense behind the app-level `where` injection below.
 *
 * Keep it OFF until: (1) the RLS SQL has been applied, and (2) every
 * `db.$transaction([...])` array call on a tenant client has been moved to
 * `withOrgContext` (array transactions can't carry the GUC).
 */
const RLS_ENABLED = process.env.DB_RLS === "on";

/**
 * Run `cb` inside one transaction with `app.current_org_id` set LOCAL, so RLS
 * policies apply. Use this instead of `db.$transaction([...])` on tenant data.
 */
export async function withOrgContext<T>(
  organizationId: string,
  cb: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!organizationId) throw new Error("withOrgContext requires a non-empty organizationId");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, true)`;
    return cb(tx);
  });
}

/**
 * Tenant-scoped client. Every model that has an `organizationId` column gets a
 * mandatory `where: { organizationId }` injected on reads and a forced
 * `organizationId` on writes. Domain code should reach the DB through this,
 * not through the raw `prisma` export.
 *
 * Models without an org column (User, Plan, GatewayEvent, PageVersion) are
 * passed through untouched — scope those manually.
 */
const ORG_SCOPED = new Set<string>([
  "Organization", // scoped by id === organizationId
  "OrganizationKyc",
  "Membership",
  "CustomDomain",
  "Subscription",
  "Campaign",
  "Page",
  "DonationOption", // via campaign; see note below
  "Donor",
  "DonorTag", // via donor
  "Donation",
  "RecurringPlan",
  "Payout",
  "KycDocument",
  "Export",
  "OutboundWebhook",
  "WebhookDelivery",
  "Sponsee",
  "SponseeUpdate",
  "Raffle",
  "RaffleTicket",
  "Event",
  "EventTicketType",
  "EventTicket",
  "Auction",
  "Lot",
  "Bid",
  "AuditLog",
]);

// Models whose org link is indirect — the extension can't add a filter safely,
// so callers must scope by the parent relation explicitly.
const INDIRECT = new Set<string>(["DonationOption", "DonorTag", "SponseeUpdate"]);

export function tenantPrisma(organizationId: string) {
  if (!organizationId) throw new Error("tenantPrisma requires a non-empty organizationId");

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const scoped = model && ORG_SCOPED.has(model) && !INDIRECT.has(model);

          if (scoped) {
            const orgKey = model === "Organization" ? "id" : "organizationId";

            const readOps = new Set([
              "findFirst",
              "findFirstOrThrow",
              "findMany",
              "findUnique",
              "findUniqueOrThrow",
              "count",
              "aggregate",
              "groupBy",
              "updateMany",
              "deleteMany",
            ]);

            if (readOps.has(operation)) {
              (args as { where?: Record<string, unknown> }).where = {
                ...(args as { where?: Record<string, unknown> }).where,
                [orgKey]: organizationId,
              };
            }

            if (operation === "create") {
              const a = args as { data?: Record<string, unknown> };
              if (model !== "Organization") a.data = { ...a.data, organizationId };
            }

            if (operation === "createMany") {
              const a = args as { data?: Record<string, unknown> | Record<string, unknown>[] };
              if (model !== "Organization" && a.data) {
                a.data = Array.isArray(a.data)
                  ? a.data.map((d) => ({ ...d, organizationId }))
                  : { ...a.data, organizationId };
              }
            }
            // update / delete / upsert operate on a unique selector; we can't
            // merge an org filter into a compound unique. Callers must ensure the
            // record belongs to the org (load-then-write, or use *Many variants).
          }

          if (!RLS_ENABLED) return query(args);

          // Pin the GUC for this operation so RLS policies apply. One extra
          // round-trip per query; acceptable for the defense-in-depth it buys.
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, true)`,
            query(args),
          ]);
          return result as unknown;
        },
      },
    },
  });
}

export type TenantPrisma = ReturnType<typeof tenantPrisma>;
export { Prisma };

/**
 * When an apadrinhamento recurrence ends, free its sponsee so someone else can
 * take over. Safe to call for non-sponsorship plans (no-op).
 */
export async function releaseSponseeForPlan(
  db: Pick<PrismaClient, "recurringPlan" | "sponsee">,
  recurringPlanId: string,
): Promise<void> {
  const plan = await db.recurringPlan.findUnique({
    where: { id: recurringPlanId },
    select: { sponseeId: true, donorId: true },
  });
  if (!plan?.sponseeId) return;
  await db.sponsee.updateMany({
    where: { id: plan.sponseeId, sponsorDonorId: plan.donorId, status: "SPONSORED" },
    data: { status: "AVAILABLE", sponsorDonorId: null, sponsoredAt: null },
  });
}

// Connected-gateway (BYOG) resolution — after `prisma` is defined above.
export * from "./crypto";
export * from "./gateway";
export * from "./donor-filters";
export * from "./email-sender";
export * from "./org-email";
export * from "./team-notify";
export * from "./plan-limits";
