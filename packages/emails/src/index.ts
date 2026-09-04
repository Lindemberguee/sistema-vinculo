import { formatBRL, type Cents } from "@donation/shared";
import type { RenderedEmail } from "./types";
import { emailShell } from "./shell";

export { sendEmail, type SendOptions } from "./send";
export { emailShell } from "./shell";
export type { RenderedEmail } from "./types";
export {
  EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_KINDS,
  WIRED_TEMPLATE_KINDS,
  SEGMENT_TRIGGER_KINDS,
  renderTemplate,
  fillTokens,
  type EmailTemplateKind,
  type EmailTemplateCategory,
  type TemplateMeta,
  type TemplateVar,
} from "./templates";
export {
  type EmailBlock,
  type EmailBlockType,
  EMAIL_BLOCK_DEFS,
  EMAIL_BLOCK_TYPES,
  newEmailBlock,
  normalizeEmailBlocks,
  renderEmailBlocks,
  sanitizeInline,
  sanitizeBlockHtml,
} from "./email-blocks";
export {
  createSendingDomain,
  getSendingDomain,
  triggerSendingDomainVerify,
  removeSendingDomain,
  type DomainInfo,
  type DomainRecord,
  type DomainStatus,
} from "./domains";

/**
 * Transactional e-mail templates. Rendered to HTML strings here so both the
 * web app and the worker can send without pulling a React renderer.
 * Swap to `@react-email/*` components when the set grows.
 */

// Account / system e-mails (no org) use the shared shell with the generic footer.
const shell = (title: string, bodyHtml: string) => emailShell(title, bodyHtml);

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function donationReceiptEmail(params: {
  donorName: string;
  orgName: string;
  campaignTitle?: string;
  amountCents: Cents;
  tipCents: Cents;
  method: string;
  paidAt: Date;
  recurring: boolean;
  manageUrl?: string;
}): RenderedEmail {
  const total = formatBRL(params.amountCents + params.tipCents);
  const subject = `Recebemos sua doação de ${total} — ${params.orgName}`;
  const line = params.campaignTitle ? `para a campanha <strong>${escape(params.campaignTitle)}</strong>` : `para <strong>${escape(params.orgName)}</strong>`;

  const bodyHtml = `
    <h1 style="font-size:20px;margin:0 0 16px">Obrigado, ${escape(params.donorName)}! 💚</h1>
    <p>Confirmamos sua doação ${line}.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:6px 0;color:#8a938f">Valor da doação</td><td style="text-align:right">${formatBRL(params.amountCents)}</td></tr>
      ${params.tipCents > 0 ? `<tr><td style="padding:6px 0;color:#8a938f">Contribuição para a plataforma</td><td style="text-align:right">${formatBRL(params.tipCents)}</td></tr>` : ""}
      <tr><td style="padding:6px 0;color:#8a938f">Total</td><td style="text-align:right"><strong>${total}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#8a938f">Forma de pagamento</td><td style="text-align:right">${escape(params.method)}</td></tr>
      <tr><td style="padding:6px 0;color:#8a938f">Data</td><td style="text-align:right">${params.paidAt.toLocaleString("pt-BR")}</td></tr>
    </table>
    ${
      params.recurring
        ? `<p style="font-size:14px;color:#8a938f">Esta é uma doação recorrente mensal.${
            params.manageUrl ? ` <a href="${escape(params.manageUrl)}">Gerenciar ou cancelar</a>.` : ""
          }</p>`
        : ""
    }
    <p>Este e-mail serve como recibo.</p>
  `;

  const text = `Obrigado, ${params.donorName}!\nDoação confirmada ${params.campaignTitle ? `para ${params.campaignTitle}` : `para ${params.orgName}`}.\nValor: ${formatBRL(params.amountCents)}${params.tipCents > 0 ? ` + ${formatBRL(params.tipCents)} plataforma` : ""}\nTotal: ${total}\nPagamento: ${params.method}\nData: ${params.paidAt.toLocaleString("pt-BR")}${params.recurring && params.manageUrl ? `\nGerenciar assinatura: ${params.manageUrl}` : ""}`;

  return { subject, html: shell(subject, bodyHtml), text };
}

export function welcomeDonorEmail(params: { donorName: string; orgName: string }): RenderedEmail {
  const subject = `Bem-vindo(a) à ${params.orgName} 💚`;
  const bodyHtml = `
    <h1 style="font-size:20px;margin:0 0 16px">Que bom ter você com a gente, ${escape(params.donorName)}!</h1>
    <p>Sua primeira doação para <strong>${escape(params.orgName)}</strong> foi confirmada. Cada contribuição faz diferença real — obrigado por fazer parte.</p>
  `;
  return { subject, html: shell(subject, bodyHtml), text: `Obrigado pela sua primeira doação para ${params.orgName}, ${params.donorName}!` };
}

export function winbackDonorEmail(params: { donorName: string; orgName: string; donateUrl: string }): RenderedEmail {
  const subject = `Sentimos sua falta na ${params.orgName}`;
  const bodyHtml = `
    <h1 style="font-size:20px;margin:0 0 16px">Olá, ${escape(params.donorName)}</h1>
    <p>Faz um tempo desde sua última doação para <strong>${escape(params.orgName)}</strong>. O trabalho continua e sua ajuda ainda importa muito.</p>
    <p style="text-align:center;margin:24px 0"><a href="${escape(params.donateUrl)}" style="background:#006B4F;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block">Doar novamente</a></p>
  `;
  return {
    subject,
    html: shell(subject, bodyHtml),
    text: `Olá ${params.donorName}, faz um tempo desde sua última doação para ${params.orgName}. Doe novamente: ${params.donateUrl}`,
  };
}

export function cardUpdateNeededEmail(params: { donorName: string; orgName: string; amountCents: Cents; attempt: number }): RenderedEmail {
  const subject = `Não conseguimos processar sua doação mensal — ${params.orgName}`;
  const bodyHtml = `
    <h1 style="font-size:20px;margin:0 0 16px">Olá, ${escape(params.donorName)}</h1>
    <p>A cobrança de ${formatBRL(params.amountCents)} da sua doação mensal para <strong>${escape(params.orgName)}</strong> não foi autorizada (tentativa ${params.attempt}).</p>
    <p>Vamos tentar novamente nos próximos dias. Se o cartão mudou, refaça a doação recorrente na página da campanha.</p>
  `;
  return { subject, html: shell(subject, bodyHtml), text: `Olá ${params.donorName}, a cobrança de ${formatBRL(params.amountCents)} da sua doação mensal para ${params.orgName} falhou (tentativa ${params.attempt}). Tentaremos de novo.` };
}

export function sponseeUpdateEmail(params: {
  sponsorName: string;
  sponseeName: string;
  orgName: string;
  title: string;
  body: string;
  photoUrl?: string;
}): RenderedEmail {
  const subject = `Novidades de ${params.sponseeName} — ${params.orgName}`;
  const bodyHtml = `
    <h1 style="font-size:20px;margin:0 0 16px">Olá, ${escape(params.sponsorName)}</h1>
    <p>${escape(params.orgName)} compartilhou uma atualização sobre <strong>${escape(params.sponseeName)}</strong>, quem você apadrinha:</p>
    <h2 style="font-size:16px;margin:16px 0 8px">${escape(params.title)}</h2>
    ${params.photoUrl ? `<p style="text-align:center"><img src="${escape(params.photoUrl)}" alt="${escape(params.sponseeName)}" style="max-width:100%;border-radius:12px"></p>` : ""}
    <p style="white-space:pre-line">${escape(params.body)}</p>
    <p style="font-size:14px;color:#8a938f">Obrigado por fazer parte dessa história. 💚</p>
  `;
  return {
    subject,
    html: shell(subject, bodyHtml),
    text: `${params.title}\n\n${params.body}\n\n— ${params.orgName}`,
  };
}

export function campaignUpdateEmail(params: {
  donorName: string;
  orgName: string;
  campaignTitle: string;
  title: string;
  /** Already-sanitized HTML. */
  bodyHtml: string;
  campaignUrl: string;
}): RenderedEmail {
  const subject = `${params.title} — ${params.campaignTitle}`;
  const bodyHtml = `
    <p style="color:#8a938f;font-size:13px;margin:0 0 4px">${escape(params.orgName)} · ${escape(params.campaignTitle)}</p>
    <h1 style="font-size:20px;margin:0 0 16px">${escape(params.title)}</h1>
    <p>Olá, ${escape(params.donorName)}. Uma novidade da campanha que você apoiou:</p>
    <div style="margin:12px 0">${params.bodyHtml}</div>
    <p style="text-align:center;margin:24px 0"><a href="${escape(params.campaignUrl)}" style="background:#006B4F;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block">Ver a campanha</a></p>
    <p style="font-size:14px;color:#8a938f">Obrigado por fazer parte. 💚</p>
  `;
  return {
    subject,
    html: shell(subject, bodyHtml),
    text: `${params.title}\n\n(${params.orgName} · ${params.campaignTitle})\n\nVeja a campanha: ${params.campaignUrl}`,
  };
}

export function verifyEmailEmail(params: { name: string; verifyUrl: string }): RenderedEmail {
  const subject = "Confirme seu e-mail";
  const bodyHtml = `
    <h1 style="font-size:20px;margin:0 0 16px">Olá, ${escape(params.name)}</h1>
    <p>Confirme seu e-mail para ativar sua conta na plataforma de doações.</p>
    <p style="text-align:center;margin:24px 0"><a href="${escape(params.verifyUrl)}" style="background:#006B4F;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block">Confirmar e-mail</a></p>
    <p style="font-size:13px;color:#8a938f">Se o botão não funcionar, abra: ${escape(params.verifyUrl)}</p>
    <p style="font-size:13px;color:#8a938f">O link vale por 24 horas. Se não foi você, ignore este e-mail.</p>
  `;
  return { subject, html: shell(subject, bodyHtml), text: `Confirme seu e-mail: ${params.verifyUrl}\n(O link vale por 24 horas.)` };
}

export function resetPasswordEmail(params: { name: string; resetUrl: string }): RenderedEmail {
  const subject = "Redefinir sua senha";
  const bodyHtml = `
    <h1 style="font-size:20px;margin:0 0 16px">Olá, ${escape(params.name)}</h1>
    <p>Recebemos um pedido para redefinir a senha da sua conta. Se foi você, clique abaixo:</p>
    <p style="text-align:center;margin:24px 0"><a href="${escape(params.resetUrl)}" style="background:#006B4F;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block">Criar nova senha</a></p>
    <p style="font-size:13px;color:#8a938f">Se o botão não funcionar, abra: ${escape(params.resetUrl)}</p>
    <p style="font-size:13px;color:#8a938f">O link vale por 1 hora. Se não foi você, ignore este e-mail — sua senha continua a mesma.</p>
  `;
  return { subject, html: shell(subject, bodyHtml), text: `Redefinir sua senha: ${params.resetUrl}\n(O link vale por 1 hora. Se não foi você, ignore.)` };
}

export function teamInviteEmail(params: {
  orgName: string;
  inviterName?: string;
  role: string;
  acceptUrl: string;
}): RenderedEmail {
  const subject = `Convite para a equipe de ${params.orgName}`;
  const by = params.inviterName ? `${escape(params.inviterName)} convidou você` : "Você foi convidado(a)";
  const bodyHtml = `
    <h1 style="font-size:20px;margin:0 0 16px">${by} para a ${escape(params.orgName)}</h1>
    <p>Função: <strong>${escape(params.role)}</strong>.</p>
    <p style="text-align:center;margin:24px 0"><a href="${escape(params.acceptUrl)}" style="background:#006B4F;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block">Aceitar convite</a></p>
    <p style="font-size:13px;color:#8a938f">Se o botão não funcionar, abra: ${escape(params.acceptUrl)}</p>
    <p style="font-size:13px;color:#8a938f">Você precisará entrar (ou criar uma conta com este mesmo e-mail) para aceitar.</p>
  `;
  return {
    subject,
    html: shell(subject, bodyHtml),
    text: `${params.inviterName ? `${params.inviterName} convidou você` : "Você foi convidado(a)"} para a equipe de ${params.orgName} (função: ${params.role}).\nAceitar: ${params.acceptUrl}`,
  };
}

export function ambassadorWelcomeEmail(params: {
  ambassadorName: string;
  orgName: string;
  campaignTitle: string;
  publicUrl: string;
  manageUrl: string;
}): RenderedEmail {
  const subject = `Sua página de embaixador está no ar — ${params.campaignTitle}`;
  const bodyHtml = `
    <h1 style="font-size:20px;margin:0 0 16px">Obrigado por embarcar, ${escape(params.ambassadorName)}! 💚</h1>
    <p>Criamos sua página pessoal de arrecadação para a campanha <strong>${escape(params.campaignTitle)}</strong> de ${escape(params.orgName)}. Compartilhe o link abaixo — cada doação por ele conta para a sua meta e para a campanha.</p>
    <p style="text-align:center;margin:24px 0"><a href="${escape(params.publicUrl)}" style="background:#006B4F;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block">Ver minha página</a></p>
    <p style="font-size:14px;color:#8a938f">Seu link para divulgar:<br><a href="${escape(params.publicUrl)}">${escape(params.publicUrl)}</a></p>
    <p style="font-size:14px;color:#8a938f">Para editar seu texto, foto e meta, use este link privado (não compartilhe):<br><a href="${escape(params.manageUrl)}">${escape(params.manageUrl)}</a></p>
  `;
  return {
    subject,
    html: shell(subject, bodyHtml),
    text: `Obrigado, ${params.ambassadorName}!\nSua página de embaixador para "${params.campaignTitle}" (${params.orgName}) está no ar.\n\nLink para divulgar: ${params.publicUrl}\nEditar sua página (link privado): ${params.manageUrl}`,
  };
}

export function raffleWinnerEmail(params: {
  donorName: string;
  orgName: string;
  raffleTitle: string;
  prize: string;
  number: number;
  resultUrl?: string;
}): RenderedEmail {
  const subject = `🎉 Você ganhou a rifa "${params.raffleTitle}" — ${params.orgName}`;
  const bodyHtml = `
    <h1 style="font-size:20px;margin:0 0 16px">Parabéns, ${escape(params.donorName)}! 🎉</h1>
    <p>O número <strong>${params.number}</strong> foi sorteado na rifa <strong>${escape(params.raffleTitle)}</strong> de ${escape(params.orgName)}.</p>
    <p>Prêmio: <strong>${escape(params.prize)}</strong></p>
    ${params.resultUrl ? `<p style="text-align:center;margin:24px 0"><a href="${escape(params.resultUrl)}" style="background:#006B4F;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block">Ver o resultado oficial</a></p>` : ""}
    <p>A organização vai entrar em contato para combinar a entrega. Obrigado por participar e apoiar a causa. 💚</p>
  `;
  return {
    subject,
    html: shell(subject, bodyHtml),
    text: `Parabéns ${params.donorName}! Número ${params.number} sorteado na rifa "${params.raffleTitle}". Prêmio: ${params.prize}.${params.resultUrl ? ` Resultado: ${params.resultUrl}` : ""}`,
  };
}

export function raffleResultEmail(params: {
  donorName: string;
  orgName: string;
  raffleTitle: string;
  winningNumber: number;
  resultUrl: string;
}): RenderedEmail {
  const subject = `Resultado da rifa "${params.raffleTitle}" — ${params.orgName}`;
  const bodyHtml = `
    <h1 style="font-size:20px;margin:0 0 16px">Olá, ${escape(params.donorName)}</h1>
    <p>A rifa <strong>${escape(params.raffleTitle)}</strong> de ${escape(params.orgName)} foi sorteada.</p>
    <p style="font-size:18px">Número sorteado: <strong>${params.winningNumber}</strong></p>
    <p style="text-align:center;margin:24px 0"><a href="${escape(params.resultUrl)}" style="background:#006B4F;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block">Conferir seus números</a></p>
    <p style="font-size:14px;color:#8a938f">A página mostra a semente do sorteio para qualquer pessoa conferir o resultado. Obrigado por participar. 💚</p>
  `;
  return {
    subject,
    html: shell(subject, bodyHtml),
    text: `Resultado da rifa "${params.raffleTitle}": número ${params.winningNumber}. Confira: ${params.resultUrl}`,
  };
}

export function auctionOutbidEmail(params: {
  donorName: string;
  orgName: string;
  lotTitle: string;
  newBidCents: Cents;
  bidUrl: string;
}): RenderedEmail {
  const subject = `Seu lance em "${params.lotTitle}" foi superado`;
  const bodyHtml = `
    <h1 style="font-size:20px;margin:0 0 16px">Olá, ${escape(params.donorName)}</h1>
    <p>Alguém deu um lance maior no lote <strong>${escape(params.lotTitle)}</strong> do leilão de ${escape(params.orgName)}.</p>
    <p>Lance atual: <strong>${formatBRL(params.newBidCents)}</strong></p>
    <p style="text-align:center;margin:24px 0"><a href="${escape(params.bidUrl)}" style="background:#006B4F;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block">Dar outro lance</a></p>
  `;
  return { subject, html: shell(subject, bodyHtml), text: `Seu lance em "${params.lotTitle}" foi superado. Lance atual: ${formatBRL(params.newBidCents)}. ${params.bidUrl}` };
}

export function auctionWonEmail(params: {
  donorName: string;
  orgName: string;
  lotTitle: string;
  bidCents: Cents;
  payUrl: string;
}): RenderedEmail {
  const subject = `🎉 Você arrematou "${params.lotTitle}" — ${params.orgName}`;
  const bodyHtml = `
    <h1 style="font-size:20px;margin:0 0 16px">Parabéns, ${escape(params.donorName)}! 🎉</h1>
    <p>Você venceu o lote <strong>${escape(params.lotTitle)}</strong> por <strong>${formatBRL(params.bidCents)}</strong>.</p>
    <p style="text-align:center;margin:24px 0"><a href="${escape(params.payUrl)}" style="background:#006B4F;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block">Pagar com Pix</a></p>
    <p>Assim que o pagamento for confirmado, ${escape(params.orgName)} combina a entrega com você.</p>
  `;
  return { subject, html: shell(subject, bodyHtml), text: `Você arrematou "${params.lotTitle}" por ${formatBRL(params.bidCents)}. Pague em: ${params.payUrl}` };
}

export function auctionPaymentReminderEmail(params: {
  donorName: string;
  orgName: string;
  lotTitle: string;
  bidCents: Cents;
  payUrl: string;
}): RenderedEmail {
  const subject = `Lembrete: pagamento do lote "${params.lotTitle}"`;
  const bodyHtml = `
    <h1 style="font-size:20px;margin:0 0 16px">Olá, ${escape(params.donorName)}</h1>
    <p>Ainda não recebemos o pagamento do lote <strong>${escape(params.lotTitle)}</strong> que você arrematou por <strong>${formatBRL(params.bidCents)}</strong> no leilão de ${escape(params.orgName)}.</p>
    <p style="text-align:center;margin:24px 0"><a href="${escape(params.payUrl)}" style="background:#006B4F;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block">Pagar com Pix</a></p>
    <p>Se o pagamento não for concluído, o lote poderá ser oferecido ao próximo maior lance.</p>
  `;
  return { subject, html: shell(subject, bodyHtml), text: `Lembrete: pague o lote "${params.lotTitle}" (${formatBRL(params.bidCents)}). ${params.payUrl}` };
}

export function eventTicketsEmail(params: {
  donorName: string;
  orgName: string;
  eventTitle: string;
  venue: string;
  startsAt: Date;
  ticketCount: number;
  ordersUrl: string;
}): RenderedEmail {
  const n = params.ticketCount;
  const subject = `Seus ${n} ingresso${n === 1 ? "" : "s"} — ${params.eventTitle}`;
  const bodyHtml = `
    <h1 style="font-size:20px;margin:0 0 16px">Tudo certo, ${escape(params.donorName)}! 🎫</h1>
    <p>Pagamento confirmado para <strong>${escape(params.eventTitle)}</strong>${params.orgName ? ` (${escape(params.orgName)})` : ""}.</p>
    <p style="color:#8a938f">${escape(params.venue)} · ${params.startsAt.toLocaleString("pt-BR")}</p>
    <p style="text-align:center;margin:24px 0"><a href="${escape(params.ordersUrl)}" style="background:#006B4F;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block">Ver ${n === 1 ? "o ingresso" : "os ingressos"} e QR Code</a></p>
    <p style="font-size:14px;color:#8a938f">Apresente o QR Code de cada ingresso na entrada. Cada ingresso entra uma vez.</p>
  `;
  return {
    subject,
    html: shell(subject, bodyHtml),
    text: `Seus ${n} ingresso(s) para "${params.eventTitle}" (${params.venue}, ${params.startsAt.toLocaleString("pt-BR")}). Acesse: ${params.ordersUrl}`,
  };
}

export function eventReminderEmail(params: {
  donorName: string;
  orgName: string;
  eventTitle: string;
  venue: string;
  address?: string | null;
  startsAt: Date;
  ordersUrl: string;
}): RenderedEmail {
  const subject = `Amanhã: ${params.eventTitle}`;
  const where = params.address ? `${escape(params.venue)} — ${escape(params.address)}` : escape(params.venue);
  const bodyHtml = `
    <h1 style="font-size:20px;margin:0 0 16px">Olá, ${escape(params.donorName)} 👋</h1>
    <p>Passando para lembrar do evento <strong>${escape(params.eventTitle)}</strong> de ${escape(params.orgName)}.</p>
    <p style="color:#8a938f">${where}<br>${params.startsAt.toLocaleString("pt-BR")}</p>
    <p style="text-align:center;margin:24px 0"><a href="${escape(params.ordersUrl)}" style="background:#006B4F;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block">Abrir meus ingressos</a></p>
  `;
  return {
    subject,
    html: shell(subject, bodyHtml),
    text: `Lembrete: "${params.eventTitle}" (${params.venue}) em ${params.startsAt.toLocaleString("pt-BR")}. Ingressos: ${params.ordersUrl}`,
  };
}

/** One-off org → donor message. `bodyText` is plain text with {nome} / {organização} tokens. */
export function donorBroadcastEmail(params: {
  donorName: string;
  orgName: string;
  subject: string;
  bodyText: string;
  unsubscribeUrl?: string;
}): RenderedEmail {
  const filled = params.bodyText
    .replace(/\{nome\}/gi, params.donorName)
    .replace(/\{organiza[cç][aã]o\}|\{org\}/gi, params.orgName);
  const html = filled
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${escape(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const unsub = params.unsubscribeUrl
    ? `<p style="margin:8px 0 0;font-size:12px;color:#8a938f"><a href="${escape(params.unsubscribeUrl)}" style="color:#8a938f">Descadastrar destes e-mails</a></p>`
    : "";
  const bodyHtml = `
    <h1 style="font-size:19px;margin:0 0 16px">${escape(params.subject)}</h1>
    <div style="font-size:15px;line-height:1.65;color:#2f3b37">${html}</div>
    <p style="margin:24px 0 0;font-size:12px;color:#8a938f">Enviado por ${escape(params.orgName)}.</p>
    ${unsub}
  `;
  const text = params.unsubscribeUrl ? `${filled}\n\n—\nDescadastrar: ${params.unsubscribeUrl}` : filled;
  return { subject: params.subject, html: shell(params.subject, bodyHtml), text };
}

export function recurringCanceledEmail(params: { donorName: string; orgName: string; reason: "failed" | "requested" }): RenderedEmail {
  const subject = `Sua doação mensal para ${params.orgName} foi encerrada`;
  const why =
    params.reason === "failed"
      ? "Encerramos após algumas tentativas de cobrança sem sucesso."
      : "Confirmamos o cancelamento a seu pedido.";
  const bodyHtml = `
    <h1 style="font-size:20px;margin:0 0 16px">Olá, ${escape(params.donorName)}</h1>
    <p>${why} Você pode recomeçar quando quiser pela página da campanha. Obrigado pelo apoio até aqui. 💚</p>
  `;
  return { subject, html: shell(subject, bodyHtml), text: `${why} Obrigado pelo apoio, ${params.donorName}.` };
}

export function pixReminderEmail(params: {
  donorName: string;
  orgName: string;
  amountCents: Cents;
  qrCodeUrl: string;
  payUrl: string;
}): RenderedEmail {
  const subject = `Sua doação recorrente de ${formatBRL(params.amountCents)} está pronta para pagamento`;
  const bodyHtml = `
    <h1 style="font-size:20px;margin:0 0 16px">Olá, ${escape(params.donorName)}</h1>
    <p>Chegou a hora da sua doação mensal para <strong>${escape(params.orgName)}</strong>.</p>
    <p style="text-align:center;margin:24px 0"><a href="${escape(params.payUrl)}" style="background:#006B4F;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block">Pagar com Pix agora</a></p>
    <p style="text-align:center"><img src="${escape(params.qrCodeUrl)}" alt="QR Code Pix" width="200" height="200"></p>
  `;
  return {
    subject,
    html: shell(subject, bodyHtml),
    text: `Olá ${params.donorName}, sua doação mensal de ${formatBRL(params.amountCents)} para ${params.orgName} está pronta. Pague em: ${params.payUrl}`,
  };
}
