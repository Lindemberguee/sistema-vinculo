import { prisma } from "@donation/db";
import { sendEmail } from "@donation/emails";
import { formatBRL } from "@donation/shared";

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/**
 * Daily digest to the org's team: a 24h snapshot. Runs hourly; only orgs whose
 * `digestHour` matches the current hour and have `dailyDigest` on are sent.
 */
export async function runTeamDigests(hour: number): Promise<{ orgs: number; sent: number }> {
  const configs = await prisma.organizationNotificationConfig.findMany({
    where: { dailyDigest: true, digestHour: hour },
    select: { organizationId: true, recipients: true },
  });
  if (configs.length === 0) return { orgs: 0, sent: 0 };

  const since = new Date(Date.now() - 24 * 3_600_000);
  let sent = 0;

  for (const cfg of configs) {
    if (cfg.recipients.length === 0) continue;
    const orgId = cfg.organizationId;

    const [org, paid, newDonors, recurringDropped, pastDue] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { displayName: true, kycStatus: true } }),
      prisma.donation.aggregate({
        where: { organizationId: orgId, status: "PAID", paidAt: { gte: since } },
        _sum: { amountCents: true, tipCents: true },
        _count: { _all: true },
      }),
      prisma.donor.count({ where: { organizationId: orgId, firstDonationAt: { gte: since } } }),
      prisma.recurringPlan.count({
        where: { organizationId: orgId, status: "CANCELED", canceledAt: { gte: since }, failedAttempts: { gt: 0 } },
      }),
      prisma.recurringPlan.count({ where: { organizationId: orgId, status: "PAST_DUE" } }),
    ]);

    const total = (paid._sum.amountCents ?? 0) + (paid._sum.tipCents ?? 0);
    const rows: [string, string][] = [
      ["Doações confirmadas (24h)", String(paid._count._all)],
      ["Valor arrecadado (24h)", formatBRL(total)],
      ["Novos doadores (24h)", String(newDonors)],
      ["Recorrências encerradas por falha (24h)", String(recurringDropped)],
      ["Recorrências em atraso (agora)", String(pastDue)],
      ["Status do KYC", String(org?.kycStatus ?? "—")],
    ];

    const body = `<h1 style="margin:0 0 14px;font-size:17px">Resumo diário — ${esc(org?.displayName ?? "")}</h1>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14px">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:7px 0;border-bottom:1px solid #eee;color:#8a938f">${k}</td><td style="padding:7px 0;border-bottom:1px solid #eee;text-align:right"><strong>${v}</strong></td></tr>`,
          )
          .join("")}
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af">Janela: últimas 24 horas.</p>`;

    const html = `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5">
  <tr><td align="center" style="padding:28px 12px">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px">
      <tr><td bgcolor="#ffffff" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;font-family:Arial,Helvetica,sans-serif;color:#2f3b37">${body}</td></tr>
      <tr><td style="padding:14px 8px 0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9ca3af">Resumo diário da plataforma · desligue em Configurações → Notificações da equipe</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
    const text = `Resumo diário — ${org?.displayName ?? ""}\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}`;
    const email = { subject: `Resumo diário — ${org?.displayName ?? ""}`, html, text };

    for (const to of cfg.recipients.slice(0, 10)) {
      try {
        await sendEmail(to, email);
        sent++;
      } catch (e) {
        console.error(`team-digest → ${to}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  return { orgs: configs.length, sent };
}
