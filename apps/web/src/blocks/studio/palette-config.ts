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

/**
 * Quick-start layouts for an empty page. Each block may carry `props` that are
 * merged over the registry defaults, so a starter lands as a *filled* draft
 * (real copy, sensible config) instead of a stack of empty blocks. Media/ID
 * fields are left blank on purpose — the editor flags them for the org to set.
 */
export interface StarterBlock {
  type: BlockType;
  props?: Record<string, unknown>;
}
export interface Starter {
  key: string;
  label: string;
  /** One line under the label in the picker. */
  hint: string;
  /** When to reach for this one. */
  goal: string;
  blocks: StarterBlock[];
}

const STORY_HTML = `<h2>Sobre a campanha</h2>
<p>Comece pelo problema: quem é afetado, desde quando e por quê. Traga um dado ou uma cena concreta — é o que faz alguém parar para ler.</p>
<p>Depois mostre a solução: o que a sua organização faz, como o dinheiro vira ação e por que <strong>agora</strong> é a hora de apoiar.</p>
<h3>O que a sua doação faz</h3>
<ul><li>R$ 50 — uma cesta de alimentos para uma família</li><li>R$ 150 — material escolar para três crianças</li><li>R$ 500 — um mês de atividades no contraturno</li></ul>`;

const FAQ_BASE = [
  { q: "Recebo recibo da doação?", a: "Sim. Assim que o pagamento é confirmado, enviamos o comprovante por e-mail." },
  { q: "É seguro doar por aqui?", a: "É. O pagamento é processado pelo gateway da própria organização (Pix, cartão ou boleto) e os dados não passam por terceiros." },
  { q: "Posso doar todo mês?", a: "Pode. Escolha a opção “mensal” no checkout — a cobrança é automática e você cancela quando quiser." },
];

export const STARTERS: Starter[] = [
  {
    key: "essencial",
    label: "Campanha essencial",
    hint: "Capa, meta, história, transparência e checkout",
    goal: "O ponto de partida completo para qualquer causa.",
    blocks: [
      { type: "hero", props: { title: "Junte-se a esta causa", subtitle: "Sua doação transforma realidades — e você acompanha cada passo.", ctaLabel: "Quero doar" } },
      { type: "progressBar", props: { showValues: true, showDonorsCount: true } },
      { type: "richText", props: { html: STORY_HTML } },
      { type: "allocation", props: { title: "Para onde vai a sua doação", items: [{ label: "Direto no projeto", amountCents: 8500 }, { label: "Operação e equipe", amountCents: 1200 }, { label: "Taxas de pagamento", amountCents: 300 }] } },
      { type: "donationCheckout" },
      { type: "campaignReports", props: { title: "Prestação de contas" } },
      { type: "faq", props: { items: FAQ_BASE } },
      { type: "footer" },
    ],
  },
  {
    key: "narrativa",
    label: "História & impacto",
    hint: "Narrativa, números que provam e depoimentos",
    goal: "Para causas que convencem melhor contando uma história.",
    blocks: [
      { type: "hero", props: { title: "Uma história que ainda está sendo escrita", subtitle: "Você pode fazer parte do próximo capítulo.", ctaLabel: "Fazer parte" } },
      { type: "progressBar", props: { showValues: true, showDonorsCount: true } },
      { type: "imageText", props: { title: "Conheça quem está por trás dos números", body: "Escolha uma pessoa ou família real atendida pelo projeto e conte, em poucas linhas, o antes e o depois. Uma foto autêntica vale mais que um banner.", imagePosition: "right" } },
      { type: "impactCounters", props: { items: [{ value: 500, suffix: "", label: "pessoas atendidas" }, { value: 12, suffix: "", label: "comunidades" }, { value: 8, suffix: " anos", label: "de atuação" }], animate: true } },
      { type: "richText", props: { html: "<h2>O que muda com a sua doação</h2><p>Traduza a meta em resultado concreto: “com R$ X.000 conseguimos Y por Z meses”. Deixe claro o que acontece se a meta não for batida.</p>" } },
      { type: "testimonials", props: { items: [{ quote: "Foi a primeira vez que senti que a minha filha teria uma chance de verdade. Hoje ela está na escola e sorri de novo.", author: "Marta S.", role: "mãe atendida pelo projeto" }, { quote: "Doo todo mês porque vejo os relatórios. O dinheiro chega onde precisa.", author: "Rafael L.", role: "doador desde 2022" }] } },
      { type: "campaignUpdates", props: { title: "Novidades da campanha" } },
      { type: "donationCheckout" },
      { type: "faq", props: { items: FAQ_BASE } },
      { type: "footer" },
    ],
  },
  {
    key: "emergencia",
    label: "Emergência com prazo",
    hint: "Contrapartida, contagem regressiva e doação rápida",
    goal: "Mobilização urgente com meta e data para fechar.",
    blocks: [
      { type: "matchBanner", props: { text: "Cada real doado é dobrado por um parceiro", detail: "Enquanto durar o fundo de contrapartida" } },
      { type: "hero", props: { title: "Ajuda urgente agora", subtitle: "A situação é crítica e o tempo é curto. Sua doação faz diferença hoje.", ctaLabel: "Doar agora" } },
      { type: "countdown", props: { title: "Tempo restante para bater a meta" } },
      { type: "progressBar", props: { showValues: true, showDonorsCount: true } },
      { type: "richText", props: { html: "<h2>O que está acontecendo</h2><p>Descreva o fato, a data e quem está sendo afetado. Seja direto — quem chega aqui quer entender rápido e ajudar rápido.</p><h3>Para onde vai a doação</h3><ul><li>Itens de primeira necessidade</li><li>Abrigo e transporte</li><li>Equipe em campo</li></ul>" } },
      { type: "amountOptions", props: { amountsCents: [3000, 5000, 10000, 20000], allowCustom: true, defaultIndex: 1 } },
      { type: "donationCheckout" },
      { type: "donorWall", props: { limit: 24, showAmount: false } },
      { type: "footer" },
    ],
  },
  {
    key: "vaquinha",
    label: "Vaquinha com recompensas",
    hint: "Cotas por faixa de doação, passo a passo e checkout",
    goal: "Crowdfunding em que cada valor ganha uma recompensa.",
    blocks: [
      { type: "hero", props: { title: "Vamos tirar este projeto do papel", subtitle: "Escolha uma cota, ganhe uma recompensa e ajude a gente a chegar lá.", ctaLabel: "Ver as cotas" } },
      { type: "progressBar", props: { showValues: true, showDonorsCount: true } },
      { type: "richText", props: { html: "<h2>O projeto</h2><p>Explique o que será feito, quanto custa e qual o prazo. Mostre que existe um plano — e que a sua organização consegue executar.</p>" } },
      { type: "rewards", props: { title: "Escolha a sua cota" } },
      { type: "steps", props: { title: "Como funciona", items: [{ title: "Escolha uma cota", body: "Cada faixa de doação tem uma recompensa." }, { title: "Confirme a doação", body: "Pix, cartão ou boleto, em menos de 1 minuto." }, { title: "Receba a recompensa", body: "A gente entra em contato assim que a campanha fechar." }] } },
      { type: "donationCheckout" },
      { type: "testimonials", props: { items: [{ quote: "Apoiei a primeira campanha e a recompensa chegou certinho. Já entrei nessa também.", author: "Bruna T.", role: "apoiadora" }] } },
      { type: "faq", props: { items: [{ q: "Quando recebo a minha recompensa?", a: "Depois que a campanha encerra e a meta é confirmada, entramos em contato para combinar o envio ou a retirada." }, { q: "E se a meta não for batida?", a: "A campanha segue com o valor arrecadado e as recompensas são entregues do mesmo jeito, salvo aviso em contrário." }, { q: "Posso doar sem escolher cota?", a: "Pode. Use o campo de valor livre no checkout." }] } },
      { type: "footer" },
    ],
  },
  {
    key: "mantenedores",
    label: "Doação recorrente",
    hint: "Por que apoiar todo mês, impacto contínuo e checkout mensal",
    goal: "Converter visitantes em doadores mensais.",
    blocks: [
      { type: "hero", props: { title: "Seja um mantenedor", subtitle: "Um valor por mês garante que o projeto não pare.", ctaLabel: "Apoiar todo mês" } },
      { type: "richText", props: { html: "<h2>Por que doar todo mês</h2><p>A doação recorrente é o que permite planejar: contratar, alugar espaço, comprar em quantidade. Explique o que a previsibilidade muda para a sua operação.</p>" } },
      { type: "steps", props: { title: "Simples assim", items: [{ title: "Escolha um valor mensal", body: "A partir de R$ 20." }, { title: "A cobrança é automática", body: "No cartão, todo mês, sem você precisar lembrar." }, { title: "Cancele quando quiser", body: "Um clique no e-mail, sem burocracia." }] } },
      { type: "impactCounters", props: { items: [{ value: 30, suffix: "/mês", label: "refeições garantidas" }, { value: 100, suffix: "%", label: "da verba prestada em conta" }, { value: 1, suffix: " min", label: "para começar" }], animate: true } },
      { type: "allocation", props: { title: "Como a sua mensalidade é usada", items: [{ label: "Programa", amountCents: 8000 }, { label: "Equipe", amountCents: 1500 }, { label: "Taxas", amountCents: 500 }] } },
      { type: "donationCheckout", props: { allowRecurring: true, allowTip: true } },
      { type: "testimonials", props: { items: [{ quote: "Cancelei duas assinaturas de streaming e virei mantenedor. Melhor troca que fiz.", author: "André M.", role: "mantenedor há 1 ano" }, { quote: "Recebo um relatório por mês. Sei exatamente o que a minha doação fez.", author: "Cláudia R.", role: "mantenedora" }] } },
      { type: "faq", props: { items: [{ q: "Quando a cobrança acontece?", a: "No mesmo dia de cada mês, a partir da data da primeira doação." }, { q: "Posso mudar o valor depois?", a: "Pode. É só cancelar a atual e criar uma nova com o novo valor." }, { q: "Como cancelo?", a: "Pelo link que vai em todo e-mail de confirmação — leva 10 segundos." }] } },
      { type: "footer" },
    ],
  },
  {
    key: "apadrinhamento",
    label: "Apadrinhamento",
    hint: "Como funciona, grade de afilhados e depoimentos",
    goal: "Campanhas em que se apadrinha uma pessoa específica.",
    blocks: [
      { type: "hero", props: { title: "Apadrinhe e acompanhe de perto", subtitle: "Escolha quem você quer apoiar e receba notícias da trajetória.", ctaLabel: "Escolher quem apadrinhar" } },
      { type: "richText", props: { html: "<h2>Como funciona o apadrinhamento</h2><p>Explique o vínculo: o que o padrinho recebe (cartas, fotos, relatórios), com que frequência, e o que o valor mensal cobre na prática.</p>" } },
      { type: "steps", props: { title: "Em três passos", items: [{ title: "Escolha uma pessoa", body: "Veja as histórias abaixo e conecte-se com uma delas." }, { title: "Defina o apoio mensal", body: "Um valor fixo, cobrado automaticamente." }, { title: "Acompanhe", body: "Você recebe atualizações ao longo do ano." }] } },
      { type: "sponseeGrid", props: { title: "Quem espera por um padrinho", columns: 3, showStory: true } },
      { type: "testimonials", props: { items: [{ quote: "Recebo uma carta por trimestre. Guardo todas. É a melhor parte do meu mês.", author: "Helena V.", role: "madrinha desde 2021" }] } },
      { type: "faq", props: { items: [{ q: "Posso trocar de afilhado?", a: "Pode, a qualquer momento, falando com a nossa equipe." }, { q: "Recebo notícias com que frequência?", a: "No mínimo a cada três meses, com fotos e um resumo do período." }, { q: "Como cancelo?", a: "Pelo link nos e-mails de confirmação. O apadrinhamento fica disponível para outra pessoa assumir." }] } },
      { type: "footer" },
    ],
  },
  {
    key: "direto",
    label: "Direto ao ponto",
    hint: "Capa, meta, valores e checkout — nada mais",
    goal: "Quando a causa já é conhecida e só falta doar.",
    blocks: [
      { type: "hero", props: { title: "Doe para a causa", subtitle: "Rápido, seguro e transparente.", ctaLabel: "Doar agora" } },
      { type: "progressBar", props: { showValues: true, showDonorsCount: true } },
      { type: "amountOptions", props: { amountsCents: [2000, 5000, 10000, 25000], allowCustom: true, defaultIndex: 1 } },
      { type: "donationCheckout" },
      { type: "footer" },
    ],
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
