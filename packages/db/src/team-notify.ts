import { sendEmail } from "@donation/emails";
import { prisma } from "./index";

/**
 * Internal alerts to the ORG's own team (not the donors). Plain, from the
 * platform address — no per-org sender, no donor template engine.
 */
export type TeamNotifyEvent = "kyc.approved" | "kyc.rejected" | "recurring.failed";

const CFG_TOGGLE: Record<TeamNotifyEvent, "kycChanges" | "recurringFailed"> = {
  "kyc.approved": "kycChanges",
  "kyc.rejected": "kycChanges",
  "recurring.failed": "recurringFailed",
};

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function internalShell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5">
  <tr><td align="center" style="padding:28px 12px">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px">
      <tr><td bgcolor="#ffffff" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;font-family:Arial,Helvetica,sans-serif;color:#2f3b37;font-size:14px;line-height:1.6">${bodyHtml}</td></tr>
      <tr><td style="padding:14px 8px 0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9ca3af">Alerta interno da plataforma · configure em Configurações → Notificações da equipe</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

interface Composed {
  subject: string;
  html: string;
  text: string;
}

function compose(event: TeamNotifyEvent, orgName: string, vars: Record<string, string>): Composed {
  switch (event) {
    case "kyc.approved":
      return {
        subject: `KYC aprovado — ${orgName}`,
        html: internalShell(
          "KYC aprovado",
          `<h1 style="margin:0 0 12px;font-size:17px">✅ KYC aprovado</h1><p style="margin:0">A verificação de <strong>${esc(orgName)}</strong> foi aprovada. A organização já pode publicar campanhas e receber doações.</p>`,
        ),
        text: `KYC aprovado — ${orgName}. A organização já pode publicar campanhas e receber doações.`,
      };
    case "kyc.rejected":
      return {
        subject: `KYC recusado — ${orgName}`,
        html: internalShell(
          "KYC recusado",
          `<h1 style="margin:0 0 12px;font-size:17px">⚠️ KYC recusado</h1><p style="margin:0 0 10px">A verificação de <strong>${esc(orgName)}</strong> foi recusada.</p>${
            vars.REASON ? `<p style="margin:0;color:#8a938f">Motivo: ${esc(vars.REASON)}</p>` : ""
          }`,
        ),
        text: `KYC recusado — ${orgName}.${vars.REASON ? ` Motivo: ${vars.REASON}` : ""}`,
      };
    case "recurring.failed":
      return {
        subject: `Doação recorrente encerrada por falha — ${orgName}`,
        html: internalShell(
          "Recorrência encerrada",
          `<h1 style="margin:0 0 12px;font-size:17px">💳 Recorrência encerrada por falha</h1><p style="margin:0">A doação mensal${
            vars.VALOR ? ` de <strong>${esc(vars.VALOR)}</strong>` : ""
          }${
            vars.DOADOR ? ` de <strong>${esc(vars.DOADOR)}</strong>` : ""
          } foi encerrada após as tentativas de cobrança sem sucesso. Vale a pena entrar em contato.</p>`,
        ),
        text: `Recorrência encerrada por falha — ${orgName}.${vars.DOADOR ? ` Doador: ${vars.DOADOR}.` : ""}${vars.VALOR ? ` Valor: ${vars.VALOR}.` : ""}`,
      };
  }
}

export async function notifyOrgTeam(
  organizationId: string,
  event: TeamNotifyEvent,
  vars: Record<string, string> = {},
): Promise<{ sent: number }> {
  const [cfg, org] = await Promise.all([
    prisma.organizationNotificationConfig.findUnique({ where: { organizationId } }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { displayName: true } }),
  ]);
  if (!cfg || !cfg[CFG_TOGGLE[event]] || cfg.recipients.length === 0) return { sent: 0 };

  const email = compose(event, org?.displayName ?? "", vars);
  let sent = 0;
  for (const to of cfg.recipients.slice(0, 10)) {
    try {
      await sendEmail(to, email);
      sent++;
    } catch (e) {
      console.error(`notifyOrgTeam ${event} → ${to}:`, e instanceof Error ? e.message : e);
    }
  }
  return { sent };
}
