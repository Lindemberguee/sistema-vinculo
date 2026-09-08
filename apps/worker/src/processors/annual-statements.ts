import { prisma, renderOrgEmail, resolveOrgSender, signUnsubscribe } from "@donation/db";
import { sendEmail } from "@donation/emails";
import { formatBRL } from "@donation/shared";
import { appOrigin } from "../urls";

const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;

/**
 * "Informe anual de doações" — once a year, e-mail each donor a summary of what
 * they gave in `year`. Opt-in per org (the ANNUAL_STATEMENT template must be
 * enabled). Deduped via EmailLog `annual-statement:<year>`, respects consent +
 * suppression, carries List-Unsubscribe.
 */
export async function runAnnualStatements(year: number): Promise<{ orgs: number; sent: number }> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const enabled = await prisma.emailTemplate.findMany({
    where: { kind: "ANNUAL_STATEMENT", locale: "pt-BR", enabled: true },
    select: { organizationId: true },
  });

  let sent = 0;
  const dedupKind = `annual-statement:${year}`;

  for (const { organizationId } of enabled) {
    const [org, sender, suppressedRows] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId }, select: { displayName: true } }),
      resolveOrgSender(organizationId),
      prisma.donorEmailStatus.findMany({ where: { organizationId }, select: { email: true } }),
    ]);
    if (!org) continue;
    const suppressed = new Set(suppressedRows.map((r) => r.email.toLowerCase()));

    const grouped = await prisma.donation.groupBy({
      by: ["donorId"],
      where: { organizationId, status: "PAID", paidAt: { gte: start, lt: end } },
      _sum: { amountCents: true, tipCents: true },
      _count: { _all: true },
    });

    for (const g of grouped) {
      const donor = await prisma.donor.findUnique({
        where: { id: g.donorId },
        select: { name: true, email: true, consent: true },
      });
      if (!donor) continue;
      if ((donor.consent as { email?: boolean } | null)?.email === false) continue;
      if (suppressed.has(donor.email.toLowerCase())) continue;

      try {
        await prisma.emailLog.create({ data: { organizationId, donorId: g.donorId, kind: dedupKind } });
      } catch {
        continue; // already sent this year
      }

      const total = (g._sum.amountCents ?? 0) + (g._sum.tipCents ?? 0);
      const email = await renderOrgEmail(organizationId, "ANNUAL_STATEMENT", {
        NOME: firstName(donor.name),
        ORGANIZACAO: org.displayName,
        ANO: String(year),
        TOTAL: formatBRL(total),
        QTD: String(g._count._all),
      });
      const unsubUrl = `${appOrigin()}/api/u/${signUnsubscribe(organizationId, g.donorId)}`;
      try {
        await sendEmail(donor.email, email, {
          from: sender.from,
          replyTo: sender.replyTo,
          headers: {
            "List-Unsubscribe": `<${unsubUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        sent++;
      } catch (e) {
        console.error(`annual-statement ${year} → ${donor.email}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  return { orgs: enabled.length, sent };
}
