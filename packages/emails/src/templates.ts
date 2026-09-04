import type { RenderedEmail } from "./types";
import { emailShell } from "./shell";
import {
  type EmailBlock,
  type EmailBlockType,
  EMAIL_BLOCK_DEFS,
  renderEmailBlocks,
} from "./email-blocks";

/**
 * Editable e-mail templates. Each `kind` has a platform default here; an org can
 * override the subject + body (stored in `EmailTemplate`). The body is authored
 * as a block list (`blocksDefault` / `EmailTemplate.blocksJson`) and compiled to
 * `bodyHtml`; `{TOKEN}` placeholders are filled at send time.
 */

export type EmailTemplateKind =
  | "DONATION_THANKS"
  | "EVENT_TICKETS"
  | "EVENT_REMINDER"
  | "RAFFLE_RESULT"
  | "RAFFLE_WINNER"
  | "AUCTION_OUTBID"
  | "AUCTION_WON"
  | "AUCTION_PAYMENT_REMINDER"
  | "PIX_INSTRUCTIONS"
  | "BOLETO_INSTRUCTIONS"
  | "DUNNING"
  | "DONATION_DECLINED"
  | "DONATION_REFUNDED"
  | "SUBSCRIPTION_CANCELED"
  | "WELCOME"
  | "BIRTHDAY"
  | "RECURRING_REMINDER"
  | "WINBACK"
  | "AMBASSADOR_WELCOME"
  | "ANNUAL_STATEMENT";

export type EmailTemplateCategory = "donation" | "payment" | "recovery" | "relationship";

export interface TemplateVar {
  token: string; // e.g. "{NOME}"
  label: string;
}

export interface TemplateMeta {
  kind: EmailTemplateKind;
  category: EmailTemplateCategory;
  label: string;
  description: string;
  /** Relationship recipes are opt-in; the others are always on. */
  optIn: boolean;
  vars: TemplateVar[];
  subjectDefault: string;
  /** Editable body as blocks — what the builder loads for a pristine template. */
  blocksDefault: EmailBlock[];
  /** `blocksDefault` compiled to HTML — the send-time fallback when no override. */
  bodyHtmlDefault: string;
}

const V = {
  NOME: { token: "{NOME}", label: "Primeiro nome do doador" },
  ORGANIZACAO: { token: "{ORGANIZACAO}", label: "Nome da organização" },
  VALOR: { token: "{VALOR}", label: "Valor da doação" },
  TOTAL: { token: "{TOTAL}", label: "Total pago (valor + gorjeta)" },
  METODO: { token: "{METODO}", label: "Forma de pagamento" },
  DATA: { token: "{DATA}", label: "Data" },
  CAMPANHA: { token: "{CAMPANHA}", label: "Nome da campanha" },
  LINK: { token: "{LINK}", label: "Link principal (recibo, ingressos, pagar…)" },
  EVENTO: { token: "{EVENTO}", label: "Nome do evento" },
  LOCAL: { token: "{LOCAL}", label: "Local do evento" },
  NUMERO: { token: "{NUMERO}", label: "Número sorteado" },
  PROXIMA_COBRANCA: { token: "{PROXIMA_COBRANCA}", label: "Data da próxima cobrança" },
  GERENCIAR: { token: "{GERENCIAR}", label: "Link para gerenciar/cancelar a recorrência" },
  PREMIO: { token: "{PREMIO}", label: "Prêmio da rifa" },
  LOTE: { token: "{LOTE}", label: "Nome do lote" },
  LANCE: { token: "{LANCE}", label: "Valor do lance" },
  QR: { token: "{QR}", label: "URL do QR Code Pix (imagem)" },
  CODIGO: { token: "{CODIGO}", label: "Linha digitável do boleto" },
  ANO: { token: "{ANO}", label: "Ano de referência" },
  QTD: { token: "{QTD}", label: "Quantidade de doações" },
} as const;

// ── block builder shorthands for the platform defaults ──────────────
let _seq = 0;
function mk(type: EmailBlockType, props: Record<string, unknown>): EmailBlock {
  return { id: `${type}-${++_seq}`, type, props: { ...EMAIL_BLOCK_DEFS[type].defaults, ...props } };
}
const H = (text: string) => mk("heading", { text, level: "h1" });
const H2 = (text: string) => mk("heading", { text, level: "h2" });
const TX = (html: string) => mk("text", { html });
const MUTED_TX = (html: string) => mk("text", { html, size: "sm", color: "#8a938f" });
const BTN = (label: string, href: string) => mk("button", { label, href, align: "center" });
const CALL = (html: string) => mk("callout", { html });
const DET = (fields: string[]) => mk("donationDetails", { fields });
const IMG = (src: string, alt = "") => mk("image", { src, alt });
const DIV = () => mk("divider", {});
const FOOT = (text: string) => mk("footer", { text });

type RawMeta = Omit<TemplateMeta, "bodyHtmlDefault">;

const RAW: Record<EmailTemplateKind, RawMeta> = {
  DONATION_THANKS: {
    kind: "DONATION_THANKS",
    category: "donation",
    label: "Agradecimento pela doação",
    description: "Assim que a doação é confirmada.",
    optIn: false,
    vars: [V.NOME, V.ORGANIZACAO, V.VALOR, V.TOTAL, V.METODO, V.DATA, V.CAMPANHA],
    subjectDefault: "Recebemos sua doação — {ORGANIZACAO}",
    blocksDefault: [
      H("Obrigado, {NOME}! 💚"),
      TX("Sua doação de <strong>{VALOR}</strong> para {ORGANIZACAO} foi confirmada. É com o apoio de pessoas como você que a nossa causa avança todos os dias."),
      H2("Resumo da doação"),
      DET(["VALOR", "TOTAL", "METODO", "DATA", "CAMPANHA"]),
      CALL("📄 Este e-mail é o seu <strong>recibo</strong>. Guarde-o para os seus registros."),
      DIV(),
      FOOT("{ORGANIZACAO} agradece a sua confiança. Este é um e-mail automático de confirmação de doação."),
    ],
  },
  EVENT_TICKETS: {
    kind: "EVENT_TICKETS",
    category: "donation",
    label: "Ingressos de evento",
    description: "Quando o pagamento dos ingressos é confirmado.",
    optIn: false,
    vars: [V.NOME, V.ORGANIZACAO, V.EVENTO, V.LOCAL, V.DATA, V.LINK],
    subjectDefault: "Seus ingressos — {EVENTO}",
    blocksDefault: [
      H("Tudo certo, {NOME}! 🎫"),
      TX("O pagamento dos seus ingressos para <strong>{EVENTO}</strong> foi confirmado. Já pode se preparar."),
      CALL("<strong>{EVENTO}</strong><br>📍 {LOCAL}<br>🗓 {DATA}"),
      BTN("Ver ingressos e QR Code", "{LINK}"),
      TX("Apresente o QR Code de cada ingresso na entrada. Cada código é válido para uma única entrada."),
      DIV(),
      FOOT("{ORGANIZACAO} · dúvidas sobre o evento? É só responder este e-mail."),
    ],
  },
  EVENT_REMINDER: {
    kind: "EVENT_REMINDER",
    category: "donation",
    label: "Lembrete de evento",
    description: "Véspera do evento, para quem tem ingresso.",
    optIn: false,
    vars: [V.NOME, V.ORGANIZACAO, V.EVENTO, V.LOCAL, V.DATA, V.LINK],
    subjectDefault: "Amanhã: {EVENTO}",
    blocksDefault: [
      H("É amanhã, {NOME}! 👋"),
      TX("Passando para lembrar do evento <strong>{EVENTO}</strong> de {ORGANIZACAO}. Estamos ansiosos para receber você."),
      CALL("📍 {LOCAL}<br>🗓 {DATA}"),
      BTN("Abrir meus ingressos", "{LINK}"),
      TX("Chegue com alguns minutos de antecedência para agilizar a entrada."),
      DIV(),
      FOOT("Você recebe este lembrete porque tem ingresso para {EVENTO}."),
    ],
  },
  RAFFLE_RESULT: {
    kind: "RAFFLE_RESULT",
    category: "donation",
    label: "Resultado de rifa",
    description: "Enviado a quem comprou números quando a rifa é sorteada.",
    optIn: false,
    vars: [V.NOME, V.ORGANIZACAO, V.CAMPANHA, V.NUMERO, V.LINK],
    subjectDefault: "Resultado da rifa {CAMPANHA} — {ORGANIZACAO}",
    blocksDefault: [
      H("A rifa foi sorteada, {NOME}"),
      TX("A rifa <strong>{CAMPANHA}</strong> de {ORGANIZACAO} já tem resultado."),
      CALL("Número sorteado<br><strong style=\"font-size:22px\">{NUMERO}</strong>"),
      BTN("Conferir os meus números", "{LINK}"),
      TX("A página do resultado mostra a semente do sorteio — qualquer pessoa pode auditar como o número foi escolhido."),
      DIV(),
      FOOT("Você participou da rifa {CAMPANHA}. Obrigado por apoiar {ORGANIZACAO}. 💚"),
    ],
  },
  RAFFLE_WINNER: {
    kind: "RAFFLE_WINNER",
    category: "donation",
    label: "Ganhador da rifa",
    description: "Para quem teve o número sorteado.",
    optIn: false,
    vars: [V.NOME, V.ORGANIZACAO, V.CAMPANHA, V.PREMIO, V.NUMERO, V.LINK],
    subjectDefault: "🎉 Você ganhou a rifa {CAMPANHA} — {ORGANIZACAO}",
    blocksDefault: [
      H("Parabéns, {NOME}! 🎉"),
      TX("O número <strong>{NUMERO}</strong> foi sorteado na rifa <strong>{CAMPANHA}</strong> de {ORGANIZACAO}. Você ganhou!"),
      CALL("Seu prêmio<br><strong style=\"font-size:18px\">{PREMIO}</strong>"),
      BTN("Ver o resultado oficial", "{LINK}"),
      TX("Nossa equipe vai entrar em contato pelos seus dados de cadastro para combinar a entrega do prêmio."),
      DIV(),
      FOOT("{ORGANIZACAO} agradece a sua participação. 💚"),
    ],
  },
  AUCTION_OUTBID: {
    kind: "AUCTION_OUTBID",
    category: "donation",
    label: "Leilão — lance superado",
    description: "Quando alguém cobre o lance de um participante.",
    optIn: false,
    vars: [V.NOME, V.ORGANIZACAO, V.LOTE, V.LANCE, V.LINK],
    subjectDefault: 'Seu lance em "{LOTE}" foi superado',
    blocksDefault: [
      H("Seu lance foi superado, {NOME}"),
      TX("Alguém ofereceu um valor maior pelo lote <strong>{LOTE}</strong> no leilão de {ORGANIZACAO}."),
      CALL("Lance atual<br><strong style=\"font-size:18px\">{LANCE}</strong>"),
      BTN("Fazer um novo lance", "{LINK}"),
      TX("O leilão ainda está aberto — dá tempo de voltar à liderança."),
      DIV(),
      FOOT("Você recebe este aviso porque participou do leilão de {ORGANIZACAO}."),
    ],
  },
  AUCTION_WON: {
    kind: "AUCTION_WON",
    category: "donation",
    label: "Leilão — lote arrematado",
    description: "Para o vencedor de um lote, com o link de pagamento.",
    optIn: false,
    vars: [V.NOME, V.ORGANIZACAO, V.LOTE, V.LANCE, V.LINK],
    subjectDefault: '🎉 Você arrematou "{LOTE}" — {ORGANIZACAO}',
    blocksDefault: [
      H("Arrematado! Parabéns, {NOME} 🎉"),
      TX("Você venceu o lote <strong>{LOTE}</strong> no leilão de {ORGANIZACAO}."),
      CALL("Valor a pagar<br><strong style=\"font-size:18px\">{LANCE}</strong>"),
      BTN("Pagar com Pix", "{LINK}"),
      TX("Assim que o pagamento for confirmado, combinamos a retirada ou o envio com você."),
      DIV(),
      FOOT("{ORGANIZACAO} · dúvidas? É só responder este e-mail."),
    ],
  },
  AUCTION_PAYMENT_REMINDER: {
    kind: "AUCTION_PAYMENT_REMINDER",
    category: "recovery",
    label: "Leilão — lembrete de pagamento",
    description: "Quando o vencedor ainda não pagou o lote.",
    optIn: false,
    vars: [V.NOME, V.ORGANIZACAO, V.LOTE, V.LANCE, V.LINK],
    subjectDefault: 'Lembrete: pagamento do lote "{LOTE}"',
    blocksDefault: [
      H("Lembrete de pagamento, {NOME}"),
      TX("Ainda não recebemos o pagamento do lote <strong>{LOTE}</strong> que você arrematou no leilão de {ORGANIZACAO}."),
      CALL("Valor a pagar<br><strong style=\"font-size:18px\">{LANCE}</strong>"),
      BTN("Pagar agora com Pix", "{LINK}"),
      TX("Se o pagamento não for concluído em breve, o lote poderá ser oferecido ao próximo maior lance."),
      DIV(),
      FOOT("Este é um lembrete automático de {ORGANIZACAO}."),
    ],
  },
  PIX_INSTRUCTIONS: {
    kind: "PIX_INSTRUCTIONS",
    category: "payment",
    label: "Pix da doação recorrente",
    description: "No dia da cobrança mensal por Pix, com o QR Code.",
    optIn: false,
    vars: [V.NOME, V.ORGANIZACAO, V.VALOR, V.LINK, V.QR],
    subjectDefault: "Sua doação mensal de {VALOR} está pronta para pagamento",
    blocksDefault: [
      H("Sua doação mensal está pronta, {NOME}"),
      TX("Chegou a data da sua contribuição recorrente para <strong>{ORGANIZACAO}</strong>, no valor de <strong>{VALOR}</strong>."),
      TX("Escaneie o QR Code abaixo pelo aplicativo do seu banco:"),
      IMG("{QR}", "QR Code Pix"),
      MUTED_TX("Precisa pausar ou cancelar a sua doação recorrente? <a href=\"{LINK}\">Gerenciar minha doação</a>."),
      DIV(),
      FOOT("Você mantém uma doação recorrente por Pix com {ORGANIZACAO}."),
    ],
  },
  BOLETO_INSTRUCTIONS: {
    kind: "BOLETO_INSTRUCTIONS",
    category: "payment",
    label: "Boleto gerado",
    description: "Quando o doador escolhe boleto — com o link do PDF e a linha digitável.",
    optIn: false,
    vars: [V.NOME, V.ORGANIZACAO, V.VALOR, V.DATA, V.LINK, V.CODIGO],
    subjectDefault: "Seu boleto de {VALOR} — {ORGANIZACAO}",
    blocksDefault: [
      H("Aqui está o seu boleto, {NOME}"),
      TX("Falta pouco para concluir a sua doação de <strong>{VALOR}</strong> para {ORGANIZACAO}. É só pagar o boleto abaixo."),
      CALL("Vencimento: <strong>{DATA}</strong>"),
      BTN("Abrir o boleto (PDF)", "{LINK}"),
      TX("Ou copie a linha digitável e pague pelo aplicativo do seu banco:"),
      CALL("<span style=\"font-family:Courier,monospace;font-size:13px\">{CODIGO}</span>"),
      TX("A confirmação do pagamento pode levar até 2 dias úteis."),
      DIV(),
      FOOT("Você recebe este e-mail porque iniciou uma doação para {ORGANIZACAO}."),
    ],
  },
  DUNNING: {
    kind: "DUNNING",
    category: "recovery",
    label: "Recuperação — atualizar cartão",
    description: "Quando uma cobrança recorrente no cartão falha.",
    optIn: false,
    vars: [V.NOME, V.ORGANIZACAO, V.VALOR, V.GERENCIAR],
    subjectDefault: "Não conseguimos renovar sua doação mensal — {ORGANIZACAO}",
    blocksDefault: [
      H("Precisamos de um ajuste, {NOME}"),
      TX("A cobrança da sua doação mensal de <strong>{VALOR}</strong> para {ORGANIZACAO} não foi autorizada pelo banco emissor do cartão."),
      TX("Isso costuma acontecer por cartão vencido, limite ou bloqueio de compras online. Atualize os dados para não interromper o seu apoio à causa."),
      BTN("Atualizar forma de pagamento", "{GERENCIAR}"),
      DIV(),
      FOOT("Vamos tentar a cobrança novamente nos próximos dias. Este é um aviso automático de {ORGANIZACAO}."),
    ],
  },
  DONATION_DECLINED: {
    kind: "DONATION_DECLINED",
    category: "recovery",
    label: "Doação recusada",
    description: "Quando o pagamento de uma doação avulsa não é autorizado. (Opcional — desligado por padrão.)",
    optIn: true,
    vars: [V.NOME, V.ORGANIZACAO, V.VALOR, V.CAMPANHA, V.LINK],
    subjectDefault: "Não conseguimos concluir sua doação — {ORGANIZACAO}",
    blocksDefault: [
      H("Olá, {NOME}"),
      TX("A sua doação de <strong>{VALOR}</strong> para {ORGANIZACAO} não pôde ser concluída — o pagamento não foi autorizado."),
      TX("Nenhum valor foi cobrado. Se quiser tentar de novo com outro cartão ou por Pix, é só usar o botão abaixo."),
      BTN("Tentar novamente", "{LINK}"),
      DIV(),
      FOOT("Este é um aviso automático de {ORGANIZACAO}. Se você não tentou doar, pode ignorar."),
    ],
  },
  DONATION_REFUNDED: {
    kind: "DONATION_REFUNDED",
    category: "recovery",
    label: "Doação estornada",
    description: "Quando o valor de uma doação é devolvido ao doador.",
    optIn: false,
    vars: [V.NOME, V.ORGANIZACAO, V.VALOR, V.DATA, V.CAMPANHA],
    subjectDefault: "Sua doação de {VALOR} foi estornada — {ORGANIZACAO}",
    blocksDefault: [
      H("Olá, {NOME}"),
      TX("Confirmamos o estorno da sua doação de <strong>{VALOR}</strong> para {ORGANIZACAO}."),
      CALL("Valor devolvido: <strong>{VALOR}</strong><br>Data do estorno: <strong>{DATA}</strong>"),
      TX("O valor volta pelo mesmo meio de pagamento usado na doação. O prazo depende do seu banco ou operadora — normalmente alguns dias úteis."),
      DIV(),
      FOOT("Dúvidas sobre o estorno? É só responder este e-mail. — {ORGANIZACAO}"),
    ],
  },
  SUBSCRIPTION_CANCELED: {
    kind: "SUBSCRIPTION_CANCELED",
    category: "recovery",
    label: "Doação mensal encerrada",
    description: "Quando a recorrência é cancelada (a pedido ou após tentativas sem sucesso).",
    optIn: false,
    vars: [V.NOME, V.ORGANIZACAO],
    subjectDefault: "Sua doação mensal para {ORGANIZACAO} foi encerrada",
    blocksDefault: [
      H("Sua doação mensal foi encerrada, {NOME}"),
      TX("Confirmamos o encerramento da sua doação recorrente para <strong>{ORGANIZACAO}</strong>. Nenhuma cobrança será feita a partir de agora."),
      CALL("💚 Cada mês do seu apoio ajudou a manter a nossa causa de pé. Muito obrigado por ter caminhado com a gente."),
      TX("Quando quiser voltar, é só refazer a sua doação pela página da campanha — estaremos por aqui."),
      DIV(),
      FOOT("Este é um e-mail automático de {ORGANIZACAO}."),
    ],
  },
  WELCOME: {
    kind: "WELCOME",
    category: "relationship",
    label: "Boas-vindas ao doador",
    description: "Na primeira doação confirmada de alguém.",
    optIn: false,
    vars: [V.NOME, V.ORGANIZACAO],
    subjectDefault: "Bem-vindo(a), {NOME} — obrigado por apoiar {ORGANIZACAO}",
    blocksDefault: [
      H("Que bom ter você com a gente, {NOME}! 💚"),
      TX("Sua primeira doação para <strong>{ORGANIZACAO}</strong> foi confirmada. A partir de agora, você faz parte dessa causa."),
      H2("O que acontece agora"),
      TX("• A sua contribuição já entrou para os projetos em andamento.<br>• De tempos em tempos, vamos te contar o que ela tornou possível.<br>• Você pode acompanhar tudo pela página da nossa campanha."),
      CALL("Tem alguém que também se importa com essa causa? Encaminhe este e-mail e convide para apoiar."),
      DIV(),
      FOOT("Você recebe este e-mail porque fez uma doação para {ORGANIZACAO}."),
    ],
  },
  BIRTHDAY: {
    kind: "BIRTHDAY",
    category: "relationship",
    label: "Aniversário do doador",
    description: "No dia do aniversário de quem já doou. (Opcional — ligue para usar.)",
    optIn: true,
    vars: [V.NOME, V.ORGANIZACAO],
    subjectDefault: "Feliz aniversário, {NOME}! 🎉",
    blocksDefault: [
      H("Feliz aniversário, {NOME}! 🎉"),
      TX("A equipe de <strong>{ORGANIZACAO}</strong> parou tudo por um instante para desejar um dia repleto de coisas boas."),
      CALL("Obrigado por fazer parte dessa causa com a gente. Pessoas generosas como você deixam o mundo um pouco melhor — inclusive nos aniversários. 💚"),
      DIV(),
      FOOT("Você recebe esta mensagem porque é doador(a) de {ORGANIZACAO}."),
    ],
  },
  WINBACK: {
    kind: "WINBACK",
    category: "relationship",
    label: "Reconquista de doador",
    description: "Para quem não doa há alguns meses e não tem doação recorrente ativa.",
    optIn: false,
    vars: [V.NOME, V.ORGANIZACAO, V.LINK],
    subjectDefault: "Sentimos sua falta na {ORGANIZACAO}",
    blocksDefault: [
      H("Sentimos sua falta, {NOME}"),
      TX("Faz um tempo desde a sua última doação para <strong>{ORGANIZACAO}</strong>. O trabalho não parou — e a sua ajuda continua fazendo diferença."),
      CALL("Com uma nova doação você retoma o apoio a projetos que dependem de gente como você para seguir de pé."),
      BTN("Fazer uma nova doação", "{LINK}"),
      MUTED_TX("Se preferir não receber mais estes e-mails, é só usar o link de descadastro no rodapé."),
      DIV(),
      FOOT("Você recebe este e-mail porque já doou para {ORGANIZACAO}."),
    ],
  },
  RECURRING_REMINDER: {
    kind: "RECURRING_REMINDER",
    category: "relationship",
    label: "Lembrete de doação recorrente",
    description: "Alguns dias antes da próxima cobrança da assinatura. (Opcional.)",
    optIn: true,
    vars: [V.NOME, V.ORGANIZACAO, V.VALOR, V.PROXIMA_COBRANCA, V.GERENCIAR],
    subjectDefault: "Sua doação mensal será renovada em breve — {ORGANIZACAO}",
    blocksDefault: [
      H("Um aviso rápido, {NOME}"),
      TX("A sua doação mensal para <strong>{ORGANIZACAO}</strong> será renovada automaticamente na próxima data de cobrança."),
      CALL("Valor: <strong>{VALOR}</strong><br>Próxima renovação: <strong>{PROXIMA_COBRANCA}</strong>"),
      TX("Você não precisa fazer nada — é só para manter tudo transparente."),
      MUTED_TX("Quer mudar o valor, a data ou pausar a doação? <a href=\"{GERENCIAR}\">Gerenciar minha doação</a>."),
      DIV(),
      FOOT("Você recebe este aviso porque mantém uma doação recorrente com {ORGANIZACAO}."),
    ],
  },
  AMBASSADOR_WELCOME: {
    kind: "AMBASSADOR_WELCOME",
    category: "relationship",
    label: "Novo embaixador de campanha",
    description: "Quando alguém cria uma página de embaixador — com o link público e o link de gestão.",
    optIn: false,
    vars: [V.NOME, V.ORGANIZACAO, V.CAMPANHA, V.LINK, V.GERENCIAR],
    subjectDefault: "Sua página de embaixador está no ar — {CAMPANHA}",
    blocksDefault: [
      H("Bem-vindo(a) ao time, {NOME}! 💚"),
      TX("Criamos a sua página pessoal de arrecadação para a campanha <strong>{CAMPANHA}</strong> de {ORGANIZACAO}. Cada doação feita pelo seu link conta para a sua meta e para a campanha."),
      BTN("Ver a minha página", "{LINK}"),
      CALL("Seu link para divulgar:<br><strong>{LINK}</strong>"),
      MUTED_TX("Para editar seu texto, foto e meta, use este link privado (não compartilhe): <a href=\"{GERENCIAR}\">painel do embaixador</a>."),
      DIV(),
      FOOT("Você recebe este e-mail porque se inscreveu como embaixador(a) de {ORGANIZACAO}."),
    ],
  },
  ANNUAL_STATEMENT: {
    kind: "ANNUAL_STATEMENT",
    category: "relationship",
    label: "Informe anual de doações",
    description: "Uma vez por ano, o resumo do que a pessoa doou no ano anterior. (Opcional.)",
    optIn: true,
    vars: [V.NOME, V.ORGANIZACAO, V.ANO, V.TOTAL, V.QTD],
    subjectDefault: "Seu resumo de doações de {ANO} — {ORGANIZACAO}",
    blocksDefault: [
      H("Obrigado por {ANO}, {NOME} 💚"),
      TX("Aqui está o resumo das suas contribuições para <strong>{ORGANIZACAO}</strong> no ano de {ANO}."),
      CALL("Total doado em {ANO}: <strong style=\"font-size:18px\">{TOTAL}</strong><br>Número de doações: <strong>{QTD}</strong>"),
      TX("Guarde este e-mail para os seus registros. Se precisar de um comprovante detalhado, item a item, é só responder pedindo."),
      TX("Cada doação sua ajudou a manter o nosso trabalho de pé. Contamos com você em {ANO} também."),
      DIV(),
      FOOT("Você recebe este resumo porque doou para {ORGANIZACAO} em {ANO}."),
    ],
  },
};

export const EMAIL_TEMPLATES = Object.fromEntries(
  (Object.entries(RAW) as [EmailTemplateKind, RawMeta][]).map(([k, m]) => [
    k,
    { ...m, bodyHtmlDefault: renderEmailBlocks(m.blocksDefault) },
  ]),
) as Record<EmailTemplateKind, TemplateMeta>;

export const EMAIL_TEMPLATE_KINDS = Object.keys(EMAIL_TEMPLATES) as EmailTemplateKind[];

/** Kinds whose send path already renders through the editable template. */
export const WIRED_TEMPLATE_KINDS: ReadonlySet<EmailTemplateKind> = new Set<EmailTemplateKind>(
  EMAIL_TEMPLATE_KINDS,
);

/**
 * Templates offerable as a segment-entry trigger: relationship recipes that only
 * need {NOME} / {ORGANIZACAO} / {LINK} (no donor-specific figures).
 */
export const SEGMENT_TRIGGER_KINDS: EmailTemplateKind[] = ["WELCOME", "WINBACK", "BIRTHDAY"];

// ── Rendering ────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** The single e-mail chassis (from ./shell), with the tenant-aware footer. */
const SHELL = (title: string, inner: string) =>
  emailShell(title, inner, { footer: "Enviado por {ORGANIZACAO}." });

/** Fill `{TOKEN}` placeholders; unknown tokens are left as-is. */
export function fillTokens(text: string, vars: Record<string, string | undefined>): string {
  return text.replace(/\{([A-Z_]+)\}/g, (m, k: string) => (vars[k] != null ? vars[k]! : m));
}

/** Turn an org template (or its default) + vars into a ready-to-send e-mail. */
export function renderTemplate(input: {
  subject: string;
  bodyHtml: string;
  vars: Record<string, string | undefined>;
  logoUrl?: string | null;
  orgName: string;
}): RenderedEmail {
  const vars = { ...input.vars, ORGANIZACAO: input.vars.ORGANIZACAO ?? input.orgName };
  const subject = fillTokens(input.subject, vars);
  const bodyInner = fillTokens(input.bodyHtml, vars);
  const logo = input.logoUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:0 0 22px"><img src="${esc(input.logoUrl)}" alt="${esc(input.orgName)}" height="44" style="height:44px;width:auto;border:0;display:block"></td></tr></table>`
    : "";
  const html = fillTokens(SHELL(subject, `${logo}${bodyInner}`), vars);
  const text = bodyInner
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { subject, html, text };
}

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
