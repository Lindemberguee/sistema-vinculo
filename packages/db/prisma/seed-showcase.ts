/**
 * Creates one polished, fully-featured example campaign so the whole campaign
 * module can be demoed end to end. Idempotent — safe to re-run.
 *
 *   pnpm --filter @donation/db exec dotenv -e ../../.env -- tsx prisma/seed-showcase.ts
 *
 * Attach to a specific org with SHOWCASE_ORG_SLUG=<slug>; otherwise it uses the
 * oldest ACTIVE organization in the database.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "historias-que-transformam";

// Money (integer cents)
const GOAL = 12_000_000;
const SUPER_GOAL = 18_000_000;
const RAISED = 8_450_000;
const OFF_PLATFORM = 1_200_000;

const IMG = {
  cover: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1600&q=80",
  who: "https://images.unsplash.com/photo-1544717297-fa95b6ee9643?w=1000&q=80",
  g1: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=900&q=80",
  g2: "https://images.unsplash.com/photo-1497486751825-1233686d5d80?w=900&q=80",
  g3: "https://images.unsplash.com/photo-1526634332515-d56c5fd16991?w=900&q=80",
};

const STORY_HTML = `
<p>Há oito anos, o <strong>Espaço Semente</strong> abre suas portas todos os dias no fim da tarde para crianças e adolescentes do bairro São Jorge. Enquanto as famílias trabalham, elas encontram aqui reforço escolar, oficinas de arte e música, uma refeição quente e, acima de tudo, adultos que acreditam nelas.</p>
<h3>O que mudou na vida de quem passou por aqui</h3>
<p>Em 2024, <strong>94% das crianças atendidas</strong> melhoraram as notas na escola e a evasão no bairro caiu pela metade. Não é mágica: é presença diária, método e afeto.</p>
<ul>
  <li>Reforço de português e matemática em turmas de no máximo 8 crianças</li>
  <li>Oficinas de teatro, percussão e artes visuais</li>
  <li>Acompanhamento pedagógico individual e roda de conversa com as famílias</li>
</ul>
<blockquote>“Minha filha era a mais quietinha da sala. Hoje ela sobe no palco.” — Dona Rosa, mãe de aluna</blockquote>
<p>Para 2025 queremos <strong>abrir 3 novas turmas</strong> e atender 300 crianças. Sua doação garante que nenhuma delas fique de fora.</p>
`;

const FAQ = [
  { q: "Recebo recibo da doação?", a: "Sim. Assim que o pagamento é confirmado, o recibo chega automaticamente no seu e-mail." },
  { q: "Posso doar todo mês?", a: "Pode. Marque a opção “tornar mensal” no checkout — você cancela quando quiser, pelo link nos e-mails." },
  { q: "Para onde vai o dinheiro?", a: "80% vai direto para o projeto pedagógico e a alimentação. O detalhamento completo está na seção “Para onde vai sua doação”." },
  { q: "A doação é dedutível de imposto?", a: "Para pessoa jurídica, sim, dentro dos limites da legislação. Fale com a gente pelo contato no rodapé." },
];

const BUDGET = [
  { label: "Projeto pedagógico", amountCents: 7_200_000 },
  { label: "Alimentação e lanches", amountCents: 2_400_000 },
  { label: "Materiais e arte", amountCents: 1_500_000 },
  { label: "Equipe e operação", amountCents: 900_000 },
];

async function main() {
  const wanted = process.env.SHOWCASE_ORG_SLUG;
  const org =
    (wanted ? await prisma.organization.findUnique({ where: { slug: wanted } }) : null) ??
    (await prisma.organization.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } })) ??
    (await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } }));

  if (!org) {
    throw new Error("Nenhuma organização encontrada. Crie uma ONG no painel antes de rodar o showcase.");
  }

  const endsAt = new Date(Date.now() + 45 * 86_400_000);

  const campaign = await prisma.campaign.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: SLUG } },
    update: {},
    create: {
      organizationId: org.id,
      slug: SLUG,
      title: "Histórias que Transformam",
      slogan: "Educação, arte e futuro para 300 crianças da comunidade",
      category: "CHILDREN",
      summary:
        "Reforço escolar, oficinas de arte e uma refeição quente todos os dias. Ajude o Espaço Semente a abrir 3 novas turmas em 2025.",
      story: STORY_HTML,
      storyUpdatedAt: new Date(),
      galleryMedia: [
        { type: "image", url: IMG.g1 },
        { type: "image", url: IMG.g2 },
        { type: "image", url: IMG.g3 },
      ],
      coverImageUrl: IMG.cover,
      type: "CROWDFUNDING",
      goalCents: GOAL,
      superGoalCents: SUPER_GOAL,
      minAmountCents: 2000,
      suggestedAmountsCents: [3000, 5000, 10000, 25000],
      allowRecurring: true,
      allowTip: true,
      endsAt,
      status: "PUBLISHED",
      raisedCents: RAISED,
      donorsCount: 412,
      offPlatformCents: OFF_PLATFORM,
      sdgGoals: [1, 4, 10],
      impactBiome: "Área urbana",
      impactFocus: "Educação",
      budget: BUDGET,
      showBudget: true,
      faq: FAQ,
      showFaq: true,
      showUpdates: true,
      dedicationEnabled: true,
      allowAmbassadors: true,
      hiddenFromDirectory: false,
      seo: {
        title: "Histórias que Transformam — Espaço Semente",
        description:
          "Educação, arte e futuro para 300 crianças da comunidade São Jorge. Doe agora e ajude a abrir 3 novas turmas.",
      },
    },
  });

  // ── Novidades ──────────────────────────────────────
  await prisma.campaignUpdate.deleteMany({ where: { campaignId: campaign.id } });
  await prisma.campaignUpdate.createMany({
    data: [
      {
        campaignId: campaign.id,
        organizationId: org.id,
        createdBy: "showcase-seed",
        publishedAt: new Date(Date.now() - 21 * 86_400_000),
        title: "Chegamos a 60% da meta!",
        body: "<p>Em três semanas, <strong>247 pessoas</strong> já doaram. Com isso garantimos o ano letivo das turmas atuais. Agora vamos atrás das 3 novas turmas.</p>",
      },
      {
        campaignId: campaign.id,
        organizationId: org.id,
        createdBy: "showcase-seed",
        publishedAt: new Date(Date.now() - 10 * 86_400_000),
        title: "Oficina de percussão estreou",
        body: "<p>Compramos os primeiros instrumentos e a oficina já tem 18 crianças inscritas. No próximo mês tem apresentação para as famílias.</p><ul><li>12 tambores</li><li>1 kit de percussão completo</li><li>Bolsa para o oficineiro</li></ul>",
      },
      {
        campaignId: campaign.id,
        organizationId: org.id,
        createdBy: "showcase-seed",
        publishedAt: new Date(Date.now() - 2 * 86_400_000),
        title: "Empresa parceira vai dobrar as doações",
        body: "<p>A partir desta semana, toda doação de até R$ 200 é <strong>dobrada</strong> por um doador-parceiro, até o limite de R$ 30 mil. É a hora de doar.</p>",
      },
    ],
  });

  // ── Prestação de contas ────────────────────────────
  await prisma.campaignReport.deleteMany({ where: { campaignId: campaign.id } });
  await prisma.campaignReport.createMany({
    data: [
      {
        campaignId: campaign.id,
        organizationId: org.id,
        publishedAt: new Date(Date.now() - 200 * 86_400_000),
        title: "Relatório anual de atividades 2024",
        url: "https://example.org/relatorios/2024-atividades.pdf",
      },
      {
        campaignId: campaign.id,
        organizationId: org.id,
        publishedAt: new Date(Date.now() - 200 * 86_400_000),
        title: "Demonstrações financeiras 2024 (auditadas)",
        url: "https://example.org/relatorios/2024-financeiro.pdf",
      },
      {
        campaignId: campaign.id,
        organizationId: org.id,
        publishedAt: new Date(Date.now() - 30 * 86_400_000),
        title: "Prestação de contas parcial — 1º trimestre 2025",
        url: "https://example.org/relatorios/2025-t1.pdf",
      },
    ],
  });

  // ── Recompensas / cotas ────────────────────────────
  await prisma.campaignReward.deleteMany({ where: { campaignId: campaign.id } });
  await prisma.campaignReward.createMany({
    data: [
      {
        campaignId: campaign.id,
        organizationId: org.id,
        sortOrder: 0,
        title: "Kit de arte para 1 criança",
        description: "Tinta, pincéis, papel e massinha para um mês de oficina.",
        amountCents: 6000,
        quantity: null,
        claimed: 0,
      },
      {
        campaignId: campaign.id,
        organizationId: org.id,
        sortOrder: 1,
        title: "1 mês de reforço escolar",
        description: "Cobre a vaga de uma criança nas turmas de português e matemática por um mês.",
        amountCents: 15000,
        quantity: 100,
        claimed: 37,
      },
      {
        campaignId: campaign.id,
        organizationId: org.id,
        sortOrder: 2,
        title: "Padrinho de turma",
        description: "Você acompanha de perto uma turma de 8 crianças por um trimestre e recebe fotos e cartas.",
        amountCents: 50000,
        quantity: 30,
        claimed: 8,
      },
      {
        campaignId: campaign.id,
        organizationId: org.id,
        sortOrder: 3,
        title: "Reforma de uma sala",
        description: "Pintura, iluminação e mobiliário novo para uma das salas do Espaço Semente. Placa de agradecimento no local.",
        amountCents: 500000,
        quantity: 5,
        claimed: 2,
      },
    ],
  });

  // ── Links de doação (rastreáveis) ──────────────────
  await prisma.donationLink.deleteMany({ where: { campaignId: campaign.id } });
  await prisma.donationLink.createMany({
    data: [
      {
        organizationId: org.id,
        campaignId: campaign.id,
        slug: "seedgw2",
        title: "Bio do Instagram",
        note: "Link fixo na bio do perfil.",
        amountCents: 5000,
        lockAmount: false,
        defaultCoverFee: true,
        utmSource: "instagram",
        utmMedium: "bio",
        utmCampaign: "historias-que-transformam",
        status: "ACTIVE",
        visits: 1840,
        donationsCount: 96,
        raisedCents: 612_000,
      },
      {
        organizationId: org.id,
        campaignId: campaign.id,
        slug: "seedkm3",
        title: "Lista de e-mail — março",
        note: "Newsletter mensal para a base de doadores.",
        suggestedAmountsCents: [3000, 6000, 12000],
        defaultRecurring: true,
        utmSource: "newsletter",
        utmMedium: "email",
        utmCampaign: "marco-2025",
        status: "ACTIVE",
        visits: 720,
        donationsCount: 58,
        raisedCents: 431_000,
      },
      {
        organizationId: org.id,
        campaignId: campaign.id,
        slug: "seedqh4",
        title: "Evento presencial — jantar",
        note: "QR nas mesas do jantar beneficente.",
        amountCents: 20000,
        lockAmount: true,
        utmSource: "evento",
        utmMedium: "qrcode",
        status: "PAUSED",
        visits: 210,
        donationsCount: 41,
        raisedCents: 820_000,
      },
    ],
  });

  // ── Embaixadores (peer-to-peer) ────────────────────
  await prisma.campaignAmbassador.deleteMany({ where: { campaignId: campaign.id } });
  await prisma.campaignAmbassador.createMany({
    data: [
      {
        organizationId: org.id,
        campaignId: campaign.id,
        slug: "mariana-corre",
        name: "Mariana Alves",
        email: "mariana.exemplo@gmail.com",
        headline: "Corro a São Silvestre pelas crianças do Espaço Semente",
        message:
          "Cresci no bairro São Jorge e sei o que o Espaço Semente muda numa vida. Cada quilômetro que eu correr no dia 31 é por uma criança que vai ter reforço, arte e uma refeição quente. Bora comigo?",
        goalCents: 500_000,
        status: "ACTIVE",
        donationsCount: 34,
        raisedCents: 372_000,
      },
      {
        organizationId: org.id,
        campaignId: campaign.id,
        slug: "time-contabil-luz",
        name: "Equipe Contábil Luz",
        email: "pessoas@exemplo.com.br",
        headline: "Nossa empresa abraçou a campanha — e você?",
        message: "Todo mês a gente separa uma parte pra causas locais. Neste trimestre a escolhida foi essa. Some com a gente.",
        goalCents: 1_000_000,
        status: "ACTIVE",
        donationsCount: 21,
        raisedCents: 640_000,
      },
      {
        organizationId: org.id,
        campaignId: campaign.id,
        slug: "pedro-aniversario",
        name: "Pedro Nunes",
        email: "pedro.exemplo@gmail.com",
        headline: "Meu aniversário é dia 12 — meu pedido é esse",
        message: "Em vez de presente, peço uma doação. Já ajudou muita gente ano passado e quero repetir.",
        goalCents: 200_000,
        status: "ACTIVE",
        donationsCount: 9,
        raisedCents: 138_000,
      },
    ],
  });

  // ── Página (blocos) ────────────────────────────────
  const blocks = [
    {
      id: "hero",
      type: "hero",
      props: {
        title: "Histórias que Transformam",
        subtitle: "Educação, arte e futuro para 300 crianças da comunidade São Jorge.",
        backgroundImageUrl: IMG.cover,
        overlay: 0.5,
        ctaLabel: "Doar agora",
        ctaTarget: "checkout",
      },
    },
    {
      id: "match",
      type: "matchBanner",
      props: {
        text: "Toda doação de até R$ 200 é dobrada por um doador-parceiro",
        detail: "até R$ 30 mil",
        until: endsAt.toLocaleDateString("pt-BR"),
      },
    },
    { id: "progress", type: "progressBar", props: { showValues: true, showDonorsCount: true } },
    {
      id: "countdown",
      type: "countdown",
      props: { title: "A campanha encerra em", deadline: endsAt.toISOString(), endedLabel: "A campanha foi encerrada" },
    },
    {
      id: "who",
      type: "imageText",
      props: {
        imageUrl: IMG.who,
        imageAlt: "Crianças em oficina de arte no Espaço Semente",
        imagePosition: "left",
        title: "Quem somos",
        body:
          "O Espaço Semente é um centro socioeducativo que atende crianças e adolescentes no contraturno escolar há 8 anos. Reforço, arte, música e uma refeição quente, todos os dias.",
        ctaLabel: "Quero apoiar",
        ctaTarget: "checkout",
      },
    },
    {
      id: "steps",
      type: "steps",
      props: {
        title: "Como sua doação vira impacto",
        items: [
          { title: "Você doa", body: "Em menos de 1 minuto, por Pix, cartão ou boleto." },
          { title: "A gente aplica", body: "80% vai direto para o projeto pedagógico e a alimentação." },
          { title: "Você acompanha", body: "Recebe novidades da campanha e a prestação de contas." },
        ],
      },
    },
    {
      id: "counters",
      type: "impactCounters",
      props: {
        animate: true,
        items: [
          { value: 300, suffix: "", label: "crianças em 2025" },
          { value: 94, suffix: "%", label: "melhoraram as notas" },
          { value: 8, suffix: " anos", label: "de projeto no bairro" },
        ],
      },
    },
    { id: "story", type: "richText", props: { html: STORY_HTML, maxWidth: "prose" } },
    { id: "allocation", type: "allocation", props: { title: "Para onde vai sua doação", items: BUDGET } },
    {
      id: "gallery",
      type: "gallery",
      props: {
        columns: 3,
        images: [
          { url: IMG.g1, alt: "Roda de leitura" },
          { url: IMG.g2, alt: "Oficina de percussão" },
          { url: IMG.g3, alt: "Atividade ao ar livre" },
        ],
      },
    },
    { id: "video", type: "videoEmbed", props: { provider: "youtube", videoId: "ysz5S6PUM-U" } },
    {
      id: "testimonials",
      type: "testimonials",
      props: {
        items: [
          {
            quote: "Minha filha era a mais quietinha da sala. Hoje ela sobe no palco e recita poesia.",
            author: "Rosa Almeida",
            role: "mãe de aluna",
            avatarUrl: "https://i.pravatar.cc/120?img=5",
          },
          {
            quote: "O reforço salvou meu ano. Passei de recuperação para o quadro de honra.",
            author: "Kauã, 13 anos",
            role: "aluno",
            avatarUrl: "https://i.pravatar.cc/120?img=12",
          },
          {
            quote: "Acompanho o projeto há 3 anos. É o investimento social mais transparente que já vi.",
            author: "Marina Costa",
            role: "doadora mensal",
            avatarUrl: "https://i.pravatar.cc/120?img=32",
          },
        ],
      },
    },
    { id: "rewards", type: "rewards", props: { title: "Escolha uma cota" } },
    {
      id: "checkout",
      type: "donationCheckout",
      props: {
        methods: ["PIX", "CREDIT_CARD", "BOLETO"],
        allowRecurring: true,
        allowTip: true,
        tipLabel: "Adicionar uma contribuição extra à causa",
      },
    },
    { id: "ambassadors", type: "ambassadorLeaderboard", props: { title: "Embaixadores da campanha", limit: 5, showJoinCta: true } },
    { id: "updates", type: "campaignUpdates", props: { title: "Novidades da campanha", limit: 5 } },
    { id: "reports", type: "campaignReports", props: { title: "Prestação de contas" } },
    { id: "faq", type: "faq", props: { items: FAQ } },
    { id: "donorwall", type: "donorWall", props: { limit: 24, showAmount: false } },
    {
      id: "footer",
      type: "footer",
      props: { text: "Espaço Semente · contato@espacosemente.org · @espacosemente", showPlatformBranding: true },
    },
  ];

  await prisma.page.upsert({
    where: { campaignId: campaign.id },
    update: { blocks, publishedBlocks: blocks, publishedAt: new Date() },
    create: {
      organizationId: org.id,
      campaignId: campaign.id,
      blocks,
      publishedBlocks: blocks,
      publishedAt: new Date(),
    },
  });

  const base = process.env.APP_BASE_DOMAIN ?? "localhost:3000";
  const scheme = base.includes("localhost") ? "http" : "https";
  console.log(`\nShowcase pronto na organização "${org.displayName}" (slug: ${org.slug}).`);
  console.log(`  Campanha:  ${scheme}://${org.slug}.${base}/${SLUG}`);
  console.log(`  Diretório: ${scheme}://${org.slug}.${base}/`);
  console.log(`  Editor:    ${scheme}://app.${base}/orgs/${org.id}/campaigns/${campaign.id}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
