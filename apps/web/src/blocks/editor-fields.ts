import type { BlockType } from "@donation/blocks";

/**
 * Declarative field config for the Inspector. The Zod schema in
 * @donation/blocks stays the source of truth on save.
 */
type Base = { key: string; label: string; hint?: string; required?: boolean };
export type Field =
  | (Base & { kind: "text" | "textarea" | "url" | "number" | "color" | "datetime" })
  | (Base & { kind: "checkbox" })
  | (Base & { kind: "select"; options: { value: string; label: string }[] })
  | (Base & { kind: "centsList" }) // reais list -> cents number[]
  | (Base & { kind: "stringList" }) // string[] via newlines
  | (Base & { kind: "faqList" }) // [{q,a}]
  | (Base & { kind: "imageList" }) // [{url,alt}]
  | (Base & { kind: "testimonialList" }) // [{quote,author,role?}]
  | (Base & { kind: "counterList" }) // [{value,suffix,label}]
  | (Base & { kind: "stepList" }) // [{title,body}]
  | (Base & { kind: "moneyList" }); // [{label,amountCents}]

export const EDITOR_FIELDS: Record<BlockType, Field[]> = {
  hero: [
    { key: "title", label: "Título", kind: "text" },
    { key: "subtitle", label: "Subtítulo", kind: "textarea" },
    { key: "backgroundImageUrl", label: "Imagem de fundo", hint: "Cole a URL de uma imagem.", kind: "url" },
    { key: "overlay", label: "Escurecer fundo", hint: "0 = nenhum, 1 = preto.", kind: "number" },
    { key: "ctaLabel", label: "Texto do botão", kind: "text" },
    {
      key: "ctaTarget",
      label: "Ação do botão",
      kind: "select",
      options: [
        { value: "checkout", label: "Ir para o checkout" },
        { value: "url", label: "Abrir uma URL" },
      ],
    },
    { key: "ctaUrl", label: "URL do botão", hint: "Usada quando a ação é “Abrir uma URL”.", kind: "url" },
  ],
  richText: [
    { key: "html", label: "Conteúdo", hint: "HTML simples: <p>, <strong>, <a>, listas…", kind: "textarea" },
    {
      key: "maxWidth",
      label: "Largura",
      kind: "select",
      options: [
        { value: "prose", label: "Coluna de leitura" },
        { value: "full", label: "Largura total" },
      ],
    },
  ],
  image: [
    { key: "url", label: "URL da imagem", kind: "url", required: true },
    { key: "alt", label: "Texto alternativo", hint: "Descreve a imagem para leitores de tela.", kind: "text" },
    { key: "caption", label: "Legenda", kind: "text" },
  ],
  gallery: [
    { key: "images", label: "Imagens", kind: "imageList", required: true },
    { key: "columns", label: "Colunas", hint: "De 1 a 4.", kind: "number" },
  ],
  amountOptions: [
    { key: "amountsCents", label: "Valores sugeridos", kind: "centsList" },
    { key: "allowCustom", label: "Permitir valor livre", kind: "checkbox" },
  ],
  donationCheckout: [
    { key: "allowRecurring", label: "Permitir doação mensal", kind: "checkbox" },
    { key: "allowTip", label: "Permitir contribuição extra", kind: "checkbox" },
    { key: "tipLabel", label: "Texto da gorjeta", kind: "text" },
  ],
  sponseeGrid: [
    { key: "title", label: "Título", kind: "text" },
    { key: "category", label: "Filtrar por categoria", hint: "Deixe vazio para mostrar todos.", kind: "text" },
    { key: "columns", label: "Colunas", hint: "De 1 a 4.", kind: "number" },
    { key: "showStory", label: "Mostrar a história", kind: "checkbox" },
  ],
  raffleWidget: [
    { key: "raffleId", label: "ID da rifa", hint: "Copie da tela da rifa.", kind: "text", required: true },
    { key: "allowPickNumbers", label: "Permitir escolher números", kind: "checkbox" },
  ],
  eventTickets: [
    { key: "eventId", label: "ID do evento", hint: "Copie da tela do evento.", kind: "text", required: true },
    { key: "askAttendeeNames", label: "Pedir nome de cada participante", kind: "checkbox" },
  ],
  auctionLots: [
    { key: "auctionId", label: "ID do leilão", hint: "Copie da tela do leilão.", kind: "text", required: true },
    { key: "columns", label: "Colunas", hint: "De 1 a 3.", kind: "number" },
  ],
  intlDonation: [
    { key: "title", label: "Título", kind: "text" },
    { key: "currencies", label: "Moedas", hint: "Uma por linha, ex.: USD.", kind: "stringList" },
  ],
  progressBar: [
    { key: "showValues", label: "Mostrar valores", kind: "checkbox" },
    { key: "showDonorsCount", label: "Mostrar nº de doadores", kind: "checkbox" },
    { key: "accentColor", label: "Cor da barra", kind: "color" },
  ],
  impactCounters: [
    { key: "items", label: "Números de impacto", kind: "counterList" },
    { key: "animate", label: "Animar contagem", kind: "checkbox" },
  ],
  testimonials: [{ key: "items", label: "Depoimentos", kind: "testimonialList" }],
  faq: [{ key: "items", label: "Perguntas e respostas", kind: "faqList" }],
  videoEmbed: [
    {
      key: "provider",
      label: "Provedor",
      kind: "select",
      options: [
        { value: "youtube", label: "YouTube" },
        { value: "vimeo", label: "Vimeo" },
      ],
    },
    { key: "videoId", label: "ID do vídeo", hint: "Ex.: dQw4w9WgXcQ (parte final da URL).", kind: "text", required: true },
  ],
  cta: [
    { key: "title", label: "Título", kind: "text" },
    { key: "body", label: "Texto", kind: "textarea" },
    { key: "buttonLabel", label: "Texto do botão", kind: "text" },
  ],
  donorWall: [
    { key: "limit", label: "Quantos doadores mostrar", hint: "De 3 a 100.", kind: "number" },
    { key: "showAmount", label: "Mostrar valor doado", kind: "checkbox" },
  ],
  footer: [
    { key: "text", label: "Texto do rodapé", kind: "text" },
    { key: "showPlatformBranding", label: "Exibir marca da plataforma", kind: "checkbox" },
  ],
  imageText: [
    { key: "imageUrl", label: "URL da imagem", kind: "url", required: true },
    { key: "imageAlt", label: "Texto alternativo", kind: "text" },
    {
      key: "imagePosition",
      label: "Posição da imagem",
      kind: "select",
      options: [
        { value: "left", label: "Esquerda" },
        { value: "right", label: "Direita" },
      ],
    },
    { key: "title", label: "Título", kind: "text", required: true },
    { key: "body", label: "Texto", kind: "textarea", required: true },
    { key: "ctaLabel", label: "Texto do botão", hint: "Deixe vazio para não mostrar botão.", kind: "text" },
    {
      key: "ctaTarget",
      label: "Ação do botão",
      kind: "select",
      options: [
        { value: "checkout", label: "Ir para o checkout" },
        { value: "url", label: "Abrir uma URL" },
      ],
    },
    { key: "ctaUrl", label: "URL do botão", kind: "url" },
  ],
  steps: [
    { key: "title", label: "Título", kind: "text" },
    { key: "items", label: "Passos", kind: "stepList", required: true },
  ],
  countdown: [
    { key: "title", label: "Título", kind: "text" },
    { key: "deadline", label: "Encerra em", kind: "datetime", required: true },
    { key: "endedLabel", label: "Texto após encerrar", kind: "text" },
  ],
  matchBanner: [
    { key: "text", label: "Mensagem", kind: "text", required: true },
    { key: "detail", label: "Detalhe", hint: "Ex.: até R$ 50 mil.", kind: "text" },
    { key: "until", label: "Válido até", hint: "Texto livre, ex.: 31/12.", kind: "text" },
  ],
  campaignUpdates: [
    { key: "title", label: "Título", kind: "text" },
    { key: "limit", label: "Quantas novidades mostrar", hint: "De 1 a 20.", kind: "number" },
  ],
  allocation: [
    { key: "title", label: "Título", kind: "text" },
    { key: "items", label: "Itens do orçamento", kind: "moneyList", required: true },
  ],
  campaignReports: [{ key: "title", label: "Título", kind: "text" }],
  rewards: [{ key: "title", label: "Título", kind: "text" }],
  ambassadorLeaderboard: [
    { key: "title", label: "Título", kind: "text" },
    { key: "limit", label: "Quantos embaixadores mostrar", hint: "De 1 a 20.", kind: "number" },
    { key: "showJoinCta", label: "Mostrar botão “Seja embaixador”", kind: "checkbox" },
  ],
  embed: [
    {
      key: "url",
      label: "Link para incorporar",
      hint: "YouTube, Vimeo, Google Forms/Agenda, Google Maps (link “Incorporar”), Typeform, Spotify, SoundCloud.",
      kind: "url",
      required: true,
    },
    {
      key: "ratio",
      label: "Proporção",
      kind: "select",
      options: [
        { value: "16:9", label: "16:9 (vídeo)" },
        { value: "4:3", label: "4:3" },
        { value: "1:1", label: "1:1 (quadrado)" },
        { value: "9:16", label: "9:16 (vertical)" },
      ],
    },
    { key: "caption", label: "Legenda", kind: "text" },
  ],
  pixKey: [
    { key: "title", label: "Título", kind: "text" },
    {
      key: "keyType",
      label: "Tipo da chave",
      kind: "select",
      options: [
        { value: "cnpj", label: "CNPJ" },
        { value: "email", label: "E-mail" },
        { value: "phone", label: "Telefone" },
        { value: "random", label: "Chave aleatória" },
      ],
    },
    { key: "keyValue", label: "Chave Pix", kind: "text", required: true },
    { key: "note", label: "Observação", kind: "text" },
  ],
};
