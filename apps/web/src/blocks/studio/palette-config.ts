import type { BlockType } from "@donation/blocks";

/** Palette organisation + copy. The registry owns labels/icons/defaults; this
 * owns grouping, ordering and the one-line descriptions shown in the picker. */
export interface PaletteItem {
  type: BlockType;
  hint: string;
}
export interface PaletteGroup {
  heading: string;
  items: PaletteItem[];
}

export const PALETTE: PaletteGroup[] = [
  {
    heading: "Destaque",
    items: [
      { type: "hero", hint: "Capa com título, imagem de fundo e botão" },
      { type: "cta", hint: "Faixa de chamada para ação" },
      { type: "matchBanner", hint: "Aviso de doação dobrada / contrapartida" },
    ],
  },
  {
    heading: "Conteúdo",
    items: [
      { type: "richText", hint: "Parágrafos, títulos e listas" },
      { type: "imageText", hint: "Imagem ao lado de um texto" },
      { type: "image", hint: "Uma imagem com legenda" },
      { type: "gallery", hint: "Grade de imagens" },
      { type: "videoEmbed", hint: "Vídeo do YouTube ou Vimeo" },
      { type: "embed", hint: "Formulário, mapa, playlist… de provedores confiáveis" },
      { type: "steps", hint: "Passo a passo de “como funciona”" },
      { type: "faq", hint: "Perguntas e respostas em acordeão" },
    ],
  },
  {
    heading: "Arrecadação",
    items: [
      { type: "donationCheckout", hint: "Formulário de doação (Pix, cartão, boleto)" },
      { type: "rewards", hint: "Cotas/recompensas por faixa de doação" },
      { type: "amountOptions", hint: "Botões de valores sugeridos" },
      { type: "progressBar", hint: "Termômetro da meta" },
      { type: "allocation", hint: "Barra “para onde vai o dinheiro”" },
      { type: "countdown", hint: "Contagem regressiva até o fim da campanha" },
      { type: "pixKey", hint: "Chave Pix com botão de copiar" },
      { type: "intlDonation", hint: "Doação em moeda estrangeira (Stripe)" },
    ],
  },
  {
    heading: "Prova social",
    items: [
      { type: "impactCounters", hint: "Números de impacto animados" },
      { type: "testimonials", hint: "Depoimentos de apoiadores" },
      { type: "donorWall", hint: "Mural com quem já doou" },
      { type: "campaignUpdates", hint: "Linha do tempo de novidades da campanha" },
      { type: "campaignReports", hint: "Links de prestação de contas" },
      { type: "ambassadorLeaderboard", hint: "Ranking de quem mais arrecada pela campanha" },
    ],
  },
  {
    heading: "Módulos",
    items: [
      { type: "sponseeGrid", hint: "Grade de afilhados para apadrinhar" },
      { type: "raffleWidget", hint: "Compra de números de uma rifa" },
      { type: "eventTickets", hint: "Venda de ingressos de um evento" },
      { type: "auctionLots", hint: "Lotes de um leilão com lances" },
    ],
  },
  {
    heading: "Rodapé",
    items: [{ type: "footer", hint: "Texto final e marca da plataforma" }],
  },
];

/** Quick-start layouts for an empty page. */
export interface Starter {
  key: string;
  label: string;
  hint: string;
  blocks: BlockType[];
}

export const STARTERS: Starter[] = [
  {
    key: "simple",
    label: "Campanha simples",
    hint: "Capa, história, termômetro e checkout",
    blocks: ["hero", "richText", "progressBar", "donationCheckout", "faq", "footer"],
  },
  {
    key: "story",
    label: "História + impacto",
    hint: "Foco em narrativa, números e depoimentos",
    blocks: ["hero", "richText", "impactCounters", "image", "testimonials", "donationCheckout", "footer"],
  },
  {
    key: "blank-cta",
    label: "Direto ao ponto",
    hint: "Capa e doação, sem rodeios",
    blocks: ["hero", "amountOptions", "donationCheckout", "footer"],
  },
];

/** Block types whose canvas preview is a mock (need server data or a live client runtime). */
export const DATA_BLOCK_TYPES = new Set<BlockType>([
  "donationCheckout",
  "sponseeGrid",
  "raffleWidget",
  "eventTickets",
  "auctionLots",
  "intlDonation",
  "donorWall",
  "countdown",
  "pixKey",
  "campaignUpdates",
  "campaignReports",
  "rewards",
  "ambassadorLeaderboard",
]);
