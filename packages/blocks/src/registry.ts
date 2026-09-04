import type { BlockType } from "./schema";

/**
 * Metadata registry — the editor sidebar and default-block factory read this.
 * The React Renderer/Editor components live in `apps/web` (they need "use client"
 * / server-component boundaries) and are wired to these types by key.
 */
export interface BlockMeta {
  type: BlockType;
  label: string;
  /** lucide-react icon name */
  icon: string;
  /** Rendered as a React Server Component (SEO/perf) unless listed as client-only. */
  clientOnly: boolean;
  /** Default props used when the editor inserts a fresh block. */
  defaults: Record<string, unknown>;
}

export const BLOCK_REGISTRY: Record<BlockType, BlockMeta> = {
  hero: { type: "hero", label: "Hero", icon: "Image", clientOnly: false, defaults: { title: "Título da campanha", overlay: 0.4, ctaLabel: "Doar agora", ctaTarget: "checkout" } },
  richText: { type: "richText", label: "Texto", icon: "Type", clientOnly: false, defaults: { html: "<p>Escreva aqui…</p>", maxWidth: "prose" } },
  image: { type: "image", label: "Imagem", icon: "Image", clientOnly: false, defaults: { url: "", alt: "" } },
  gallery: { type: "gallery", label: "Galeria", icon: "Images", clientOnly: false, defaults: { images: [], columns: 3 } },
  amountOptions: { type: "amountOptions", label: "Valores sugeridos", icon: "CircleDollarSign", clientOnly: true, defaults: { amountsCents: [2000, 5000, 10000, 25000], allowCustom: true, defaultIndex: 1 } },
  donationCheckout: { type: "donationCheckout", label: "Checkout de doação", icon: "HandCoins", clientOnly: true, defaults: { methods: ["PIX", "CREDIT_CARD", "BOLETO"], allowRecurring: true, allowTip: true, tipLabel: "Adicionar uma contribuição extra à causa" } },
  sponseeGrid: { type: "sponseeGrid", label: "Grade de apadrinhamento", icon: "Users", clientOnly: false, defaults: { title: "Escolha quem apadrinhar", columns: 3, showStory: true } },
  raffleWidget: { type: "raffleWidget", label: "Rifa", icon: "Ticket", clientOnly: true, defaults: { raffleId: "", quickAmounts: [1, 5, 10, 20], allowPickNumbers: true } },
  eventTickets: { type: "eventTickets", label: "Ingressos de evento", icon: "CalendarDays", clientOnly: true, defaults: { eventId: "", askAttendeeNames: false } },
  auctionLots: { type: "auctionLots", label: "Leilão", icon: "Gavel", clientOnly: true, defaults: { auctionId: "", columns: 2 } },
  intlDonation: { type: "intlDonation", label: "Doação internacional", icon: "Globe", clientOnly: true, defaults: { title: "Donate from abroad", currencies: ["USD", "EUR"], suggestedAmounts: [10, 25, 50, 100] } },
  progressBar: { type: "progressBar", label: "Termômetro", icon: "BarChart3", clientOnly: false, defaults: { showValues: true, showDonorsCount: true } },
  impactCounters: { type: "impactCounters", label: "Contadores de impacto", icon: "Hash", clientOnly: true, defaults: { items: [{ value: 500, suffix: "", label: "famílias" }], animate: true } },
  testimonials: { type: "testimonials", label: "Depoimentos", icon: "Quote", clientOnly: false, defaults: { items: [] } },
  faq: { type: "faq", label: "Perguntas frequentes", icon: "HelpCircle", clientOnly: false, defaults: { items: [{ q: "", a: "" }] } },
  videoEmbed: { type: "videoEmbed", label: "Vídeo", icon: "Video", clientOnly: false, defaults: { provider: "youtube", videoId: "" } },
  cta: { type: "cta", label: "Chamada para ação", icon: "MousePointerClick", clientOnly: false, defaults: { title: "Faça parte dessa mudança", buttonLabel: "Doar agora", target: "checkout" } },
  donorWall: { type: "donorWall", label: "Mural de doadores", icon: "Users", clientOnly: false, defaults: { limit: 20, showAmount: false } },
  footer: { type: "footer", label: "Rodapé", icon: "PanelBottom", clientOnly: false, defaults: { showPlatformBranding: true } },
  imageText: { type: "imageText", label: "Imagem + texto", icon: "Columns2", clientOnly: false, defaults: { imageUrl: "", imageAlt: "", imagePosition: "left", title: "Um título forte aqui", body: "Conte um trecho da história em poucas linhas.", ctaTarget: "checkout" } },
  steps: { type: "steps", label: "Como funciona", icon: "ListOrdered", clientOnly: false, defaults: { title: "Como funciona", items: [{ title: "Você doa", body: "Em menos de 1 minuto, por Pix ou cartão." }, { title: "A gente aplica", body: "Cada real vai direto para o projeto." }, { title: "Você acompanha", body: "Recebe atualizações do impacto." }] } },
  countdown: { type: "countdown", label: "Contagem regressiva", icon: "Timer", clientOnly: true, defaults: { title: "A campanha encerra em", deadline: "", endedLabel: "A campanha foi encerrada" } },
  matchBanner: { type: "matchBanner", label: "Doação dobrada", icon: "Sparkles", clientOnly: false, defaults: { text: "Toda doação é dobrada por um doador-parceiro" } },
  pixKey: { type: "pixKey", label: "Chave Pix", icon: "QrCode", clientOnly: true, defaults: { title: "Doe direto pelo Pix", keyType: "cnpj", keyValue: "" } },
  embed: { type: "embed", label: "Incorporar (embed)", icon: "AppWindow", clientOnly: false, defaults: { url: "", ratio: "16:9" } },
  campaignUpdates: { type: "campaignUpdates", label: "Novidades da campanha", icon: "Newspaper", clientOnly: false, defaults: { title: "Novidades da campanha", limit: 5 } },
  allocation: { type: "allocation", label: "Para onde vai a doação", icon: "PieChart", clientOnly: false, defaults: { title: "Para onde vai sua doação", items: [{ label: "Projeto", amountCents: 8000 }, { label: "Operação", amountCents: 1500 }, { label: "Taxas", amountCents: 500 }] } },
  campaignReports: { type: "campaignReports", label: "Prestação de contas", icon: "FileText", clientOnly: false, defaults: { title: "Prestação de contas" } },
  rewards: { type: "rewards", label: "Recompensas (cotas)", icon: "Gift", clientOnly: false, defaults: { title: "Recompensas" } },
  ambassadorLeaderboard: { type: "ambassadorLeaderboard", label: "Ranking de embaixadores", icon: "Trophy", clientOnly: false, defaults: { title: "Embaixadores", limit: 5, showJoinCta: true } },
};

export const BLOCK_TYPES = Object.keys(BLOCK_REGISTRY) as BlockType[];

let counter = 0;
export function newBlock(type: BlockType) {
  const meta = BLOCK_REGISTRY[type];
  return { id: `${type}-${Date.now().toString(36)}-${(counter++).toString(36)}`, type, props: structuredClone(meta.defaults) };
}
