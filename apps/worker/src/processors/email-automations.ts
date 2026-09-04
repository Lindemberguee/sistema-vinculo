import { prisma, renderOrgEmail, resolveOrgSender, signUnsubscribe } from "@donation/db";
import { sendEmail } from "@donation/emails";
import { formatBRL } from "@donation/shared";
import { manageUrl } from "../donations";

const APP_BASE = process.env.APP_BASE_DOMAIN ?? "localhost:3000";
const APP_SCHEME = APP_BASE.includes("localhost") ? "http" : "https";
const appOrigin = APP_BASE.startsWith("app.") ? `${APP_SCHEME}://${APP_BASE}` : `${APP_SCHEME}://app.${APP_BASE}`;

const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

type Kind = "WELCOME" | "BIRTHDAY" | "RECURRING_REMINDER";
interface DonorRow {
  id: string;
  name: string;
  email: string;
  consent: unknown;
}

/** Per-org context, resolved once per run. */
async function orgContext(organizationId: string) {
  const [sender, suppressedRows, org] = await Promise.all([
    resolveOrgSender(organizationId),
    prisma.donorEmailStatus.findMany({ where: { organizationId }, select: { email: true } }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { displayName: true } }),
  ]);
  return {
    sender,
    orgName: org?.displayName ?? "",
    suppressed: new Set(suppressedRows.map((r) => r.email.toLowerCase())),
  };
}

async function deliver(
  ctx: Awaited<ReturnType<typeof orgContext>>,
  organizationId: string,
  donor: DonorRow,
  kind: Kind,
  dedupKind: string,
  vars: Record<string, string>,
): Promise<boolean> {
  const consent = (donor.consent ?? {}) as { email?: boolean };
  if (consent.email === false || ctx.suppressed.has(donor.email.toLowerCase())) return false;

  try {
    await prisma.emailLog.create({ data: { organizationId, donorId: donor.id, kind: dedupKind } });
  } catch {
    return false; // already sent
  }

  const email = await renderOrgEmail(organizationId, kind, {
    NOME: firstName(donor.name),
    ORGANIZACAO: ctx.orgName,
    ...vars,
  });
  const unsubUrl = `${appOrigin}/api/u/${signUnsubscribe(organizationId, donor.id)}`;
  await sendEmail(donor.email, email, {
    from: ctx.sender.from,
    replyTo: ctx.sender.replyTo,
    headers: {
      "List-Unsubscribe": `<${unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  return true;
}

/** orgIds that have an opt-in relationship recipe turned on. */
async function enabledOrgs(kind: Kind): Promise<string[]> {
  const rows = await prisma.emailTemplate.findMany({
    where: { kind, locale: "pt-BR", enabled: true },
    select: { organizationId: true },
  });
  return rows.map((r) => r.organizationId);
}

// ── WELCOME — 1st paid donation, always on ──────────────────────────
async function runWelcome(): Promise<number> {
  const donors = await prisma.donor.findMany({
    where: { donationsCount: { gte: 1 }, firstDonationAt: { gte: daysFromNow(-2) } },
    take: 1000,
    select: { id: true, name: true, email: true, consent: true, organizationId: true },
  });

  const byOrg = new Map<string, typeof donors>();
  for (const d of donors) {
    const list = byOrg.get(d.organizationId);
    if (list) list.push(d);
    else byOrg.set(d.organizationId, [d]);
  }

  let sent = 0;
  for (const [orgId, list] of byOrg) {
    const ctx = await orgContext(orgId);
    for (const d of list) if (await deliver(ctx, orgId, d, "WELCOME", "welcome", {})) sent++;
  }
  return sent;
}

// ── BIRTHDAY — opt-in ──────────────────────────────────────────────
async function runBirthday(): Promise<number> {
  const orgIds = await enabledOrgs("BIRTHDAY");
  if (orgIds.length === 0) return 0;

  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear();

  let sent = 0;
  for (const orgId of orgIds) {
    const donors = await prisma.$queryRaw<DonorRow[]>`
      SELECT id, name, email, consent FROM "Donor"
      WHERE "organizationId" = ${orgId}
        AND birthdate IS NOT NULL
        AND EXTRACT(MONTH FROM birthdate) = ${month}
        AND EXTRACT(DAY FROM birthdate) = ${day}`;
    if (donors.length === 0) continue;

    const ctx = await orgContext(orgId);
    for (const d of donors) {
      if (await deliver(ctx, orgId, d, "BIRTHDAY", `birthday:${year}`, {})) sent++;
    }
  }
  return sent;
}

// ── RECURRING_REMINDER — opt-in, ~D-3 before next charge ────────────
async function runRecurringReminder(): Promise<number> {
  const orgIds = await enabledOrgs("RECURRING_REMINDER");
  if (orgIds.length === 0) return 0;

  const plans = await prisma.recurringPlan.findMany({
    where: {
      organizationId: { in: orgIds },
      status: { in: ["ACTIVE", "PAST_DUE"] },
      nextChargeAt: { gte: daysFromNow(2), lte: daysFromNow(4) },
    },
    select: {
      id: true,
      amountCents: true,
      tipCents: true,
      nextChargeAt: true,
      cancelToken: true,
      organizationId: true,
      donor: { select: { id: true, name: true, email: true, consent: true } },
    },
  });

  const ctxByOrg = new Map<string, Awaited<ReturnType<typeof orgContext>>>();
  let sent = 0;
  for (const plan of plans) {
    let ctx = ctxByOrg.get(plan.organizationId);
    if (!ctx) {
      ctx = await orgContext(plan.organizationId);
      ctxByOrg.set(plan.organizationId, ctx);
    }
    const cycle = plan.nextChargeAt.toISOString().slice(0, 10);
    const ok = await deliver(
      ctx,
      plan.organizationId,
      plan.donor,
      "RECURRING_REMINDER",
      `recurring-reminder:${plan.id}:${cycle}`,
      {
        VALOR: formatBRL(plan.amountCents + plan.tipCents),
        PROXIMA_COBRANCA: plan.nextChargeAt.toLocaleDateString("pt-BR"),
        GERENCIAR: manageUrl(plan.cancelToken),
      },
    );
    if (ok) sent++;
  }
  return sent;
}

export async function runEmailAutomations(): Promise<{ welcome: number; birthday: number; recurring: number }> {
  const [welcome, birthday, recurring] = await Promise.all([
    runWelcome(),
    runBirthday(),
    runRecurringReminder(),
  ]);
  return { welcome, birthday, recurring };
}
