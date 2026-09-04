import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ── Platform plans ────────────────────────────────
  const plans = [
    { id: "free", name: "Free", monthlyCents: 0, platformFeeBps: 690, platformFeeFixedCents: 0, limits: { maxCampaigns: 1, maxUsers: 2, customDomain: false, removeBranding: false, modules: [] } },
    { id: "essencial", name: "Essencial", monthlyCents: 9900, platformFeeBps: 490, platformFeeFixedCents: 0, limits: { maxCampaigns: null, maxUsers: 5, customDomain: false, removeBranding: true, modules: ["crm"] } },
    { id: "pro", name: "Pro", monthlyCents: 29900, platformFeeBps: 390, platformFeeFixedCents: 0, limits: { maxCampaigns: null, maxUsers: 10, customDomain: true, removeBranding: true, modules: ["crm", "raffles", "events", "auctions", "sponsees", "links", "ambassadors", "intl"] } },
    { id: "enterprise", name: "Enterprise", monthlyCents: 0, platformFeeBps: 290, platformFeeFixedCents: 0, isPublic: false, limits: { maxCampaigns: null, maxUsers: null, customDomain: true, removeBranding: true, modules: ["*"] } },
  ];

  for (const p of plans) {
    await prisma.plan.upsert({ where: { id: p.id }, create: p, update: p });
  }

  // ── Demo organization + published campaign ────────
  const org = await prisma.organization.upsert({
    where: { slug: "instituto-demo" },
    update: {},
    create: {
      slug: "instituto-demo",
      legalName: "Instituto Demonstração",
      displayName: "Instituto Demo",
      cnpj: "00000000000191",
      status: "ACTIVE",
      kycStatus: "APPROVED",
      planId: "essencial",
      branding: { primaryColor: "#006B4F", secondaryColor: "#0A8060", accentColor: "#C5A059" },
    },
  });

  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      planId: org.planId,
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    },
  });

  const campaign = await prisma.campaign.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "agua-limpa" } },
    update: {},
    create: {
      organizationId: org.id,
      slug: "agua-limpa",
      title: "Água limpa para 500 famílias",
      summary: "Ajude a construir poços artesianos no semiárido.",
      type: "CROWDFUNDING",
      goalCents: 5_000_000,
      status: "PUBLISHED",
      seo: { title: "Água limpa para 500 famílias", description: "Doe agora e transforme vidas." },
    },
  });

  await prisma.page.upsert({
    where: { campaignId: campaign.id },
    update: {},
    create: {
      organizationId: org.id,
      campaignId: campaign.id,
      blocks: [
        { id: "b1", type: "hero", props: { title: campaign.title, subtitle: campaign.summary, ctaLabel: "Doar agora", ctaTarget: "checkout", overlay: 0.4 } },
        { id: "b2", type: "progressBar", props: { showValues: true } },
        { id: "b3", type: "amountOptions", props: { amountsCents: [2000, 5000, 10000, 25000], allowCustom: true } },
        { id: "b4", type: "donationCheckout", props: { methods: ["PIX", "CREDIT_CARD", "BOLETO"], allowRecurring: true, allowTip: true } },
        { id: "b5", type: "faq", props: { items: [{ q: "Recebo recibo?", a: "Sim, por e-mail assim que o pagamento é confirmado." }] } },
      ],
      publishedBlocks: [
        { id: "b1", type: "hero", props: { title: campaign.title, subtitle: campaign.summary, ctaLabel: "Doar agora", ctaTarget: "checkout", overlay: 0.4 } },
        { id: "b2", type: "progressBar", props: { showValues: true } },
        { id: "b3", type: "amountOptions", props: { amountsCents: [2000, 5000, 10000, 25000], allowCustom: true } },
        { id: "b4", type: "donationCheckout", props: { methods: ["PIX", "CREDIT_CARD", "BOLETO"], allowRecurring: true, allowTip: true } },
      ],
      publishedAt: new Date(),
    },
  });

  // ── Demo owner user ──────────────────────────────
  const owner = await prisma.user.upsert({
    where: { email: "owner@demo.test" },
    update: {},
    create: {
      email: "owner@demo.test",
      name: "Maria (Demo)",
      passwordHash: await bcrypt.hash("demo12345", 10),
      emailVerified: new Date(),
    },
  });

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: owner.id, organizationId: org.id } },
    update: { role: "OWNER" },
    create: { userId: owner.id, organizationId: org.id, role: "OWNER" },
  });

  // ── Demo apadrinhamento campaign + sponsees ───────
  const sponsorCampaign = await prisma.campaign.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "apadrinhe" } },
    update: {},
    create: {
      organizationId: org.id,
      slug: "apadrinhe",
      title: "Apadrinhe uma criança",
      summary: "Acompanhe de perto o desenvolvimento de quem você apoia.",
      type: "APADRINHAMENTO",
      status: "PUBLISHED",
    },
  });
  const sponsorBlocks = [
    { id: "s1", type: "hero", props: { title: "Apadrinhe uma criança", subtitle: "R$ 50/mês transformam uma história.", ctaLabel: "Escolher", ctaTarget: "url", ctaUrl: "#sponsees", overlay: 0.4 } },
    { id: "s2", type: "sponseeGrid", props: { title: "Quem espera por você", columns: 3, showStory: true } },
    { id: "s3", type: "faq", props: { items: [{ q: "Posso cancelar?", a: "Sim, quando quiser, pelo link nos e-mails." }] } },
  ];
  await prisma.page.upsert({
    where: { campaignId: sponsorCampaign.id },
    update: {},
    create: {
      organizationId: org.id,
      campaignId: sponsorCampaign.id,
      blocks: sponsorBlocks,
      publishedBlocks: sponsorBlocks,
      publishedAt: new Date(),
    },
  });
  for (const s of [
    { name: "Ana", category: "Criança", birthYear: 2016, story: "Gosta de desenhar e sonha em ser veterinária." },
    { name: "Bruno", category: "Criança", birthYear: 2014, story: "Joga futebol e ajuda a cuidar dos irmãos mais novos." },
    { name: "Cecília", category: "Criança", birthYear: 2017, story: "Aprendeu a ler este ano e adora histórias de bichos." },
  ]) {
    await prisma.sponsee.upsert({
      where: { id: `seed-sponsee-${s.name.toLowerCase()}` },
      update: {},
      create: {
        id: `seed-sponsee-${s.name.toLowerCase()}`,
        organizationId: org.id,
        campaignId: sponsorCampaign.id,
        name: s.name,
        category: s.category,
        birthYear: s.birthYear,
        story: s.story,
        monthlyAmountCents: 5000,
        status: "AVAILABLE",
      },
    });
  }

  // ── Demo rifa ────────────────────────────────────
  const raffle = await prisma.raffle.upsert({
    where: { id: "seed-raffle-cesta" },
    update: {},
    create: {
      id: "seed-raffle-cesta",
      organizationId: org.id,
      title: "Rifa da cesta de Natal",
      description: "Concorra a uma cesta gigante e ajude nossos projetos.",
      prize: "Cesta de Natal premium + panetone artesanal",
      ticketPriceCents: 1000,
      totalNumbers: 500,
      minPerPurchase: 1,
      maxPerPurchase: 20,
      status: "OPEN",
    },
  });
  const raffleCampaign = await prisma.campaign.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "rifa" } },
    update: {},
    create: {
      organizationId: org.id,
      slug: "rifa",
      title: raffle.title,
      summary: raffle.description,
      type: "DONATION",
      status: "PUBLISHED",
    },
  });
  const raffleBlocks = [
    { id: "r1", type: "hero", props: { title: raffle.title, subtitle: `Prêmio: ${raffle.prize}`, ctaLabel: "Comprar números", ctaTarget: "url", ctaUrl: "#checkout", overlay: 0.4 } },
    { id: "r2", type: "raffleWidget", props: { raffleId: raffle.id, quickAmounts: [1, 5, 10, 20], allowPickNumbers: true } },
  ];
  await prisma.page.upsert({
    where: { campaignId: raffleCampaign.id },
    update: {},
    create: {
      organizationId: org.id,
      campaignId: raffleCampaign.id,
      blocks: raffleBlocks,
      publishedBlocks: raffleBlocks,
      publishedAt: new Date(),
    },
  });

  // ── Demo evento ──────────────────────────────────
  const event = await prisma.event.upsert({
    where: { id: "seed-event-jantar" },
    update: {},
    create: {
      id: "seed-event-jantar",
      organizationId: org.id,
      title: "Jantar beneficente",
      description: "Uma noite especial em prol dos nossos projetos, com música ao vivo.",
      venue: "Salão Comunitário Verdescola",
      address: "Rua das Flores, 100",
      startsAt: new Date(Date.now() + 30 * 86_400_000),
      status: "PUBLISHED",
    },
  });
  for (const t of [
    { id: "seed-tt-inteira", name: "Inteira", priceCents: 12000, quantity: 120 },
    { id: "seed-tt-meia", name: "Meia", priceCents: 6000, quantity: 40 },
    { id: "seed-tt-mesa", name: "Mesa (8 lugares)", priceCents: 80000, quantity: 15, maxPerOrder: 2 },
  ]) {
    await prisma.eventTicketType.upsert({
      where: { id: t.id },
      update: {},
      create: { id: t.id, eventId: event.id, organizationId: org.id, name: t.name, priceCents: t.priceCents, quantity: t.quantity, maxPerOrder: (t as { maxPerOrder?: number }).maxPerOrder ?? 6 },
    });
  }
  const eventCampaign = await prisma.campaign.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "jantar" } },
    update: {},
    create: { organizationId: org.id, slug: "jantar", title: event.title, summary: event.description, type: "EVENT", status: "PUBLISHED" },
  });
  const eventBlocks = [
    { id: "e1", type: "hero", props: { title: event.title, subtitle: event.venue, ctaLabel: "Comprar ingressos", ctaTarget: "url", ctaUrl: "#checkout", overlay: 0.4 } },
    { id: "e2", type: "eventTickets", props: { eventId: event.id, askAttendeeNames: false } },
  ];
  await prisma.page.upsert({
    where: { campaignId: eventCampaign.id },
    update: {},
    create: { organizationId: org.id, campaignId: eventCampaign.id, blocks: eventBlocks, publishedBlocks: eventBlocks, publishedAt: new Date() },
  });

  // ── Demo leilão ──────────────────────────────────
  const auction = await prisma.auction.upsert({
    where: { id: "seed-auction-arte" },
    update: {},
    create: {
      id: "seed-auction-arte",
      organizationId: org.id,
      title: "Leilão de arte solidária",
      description: "Obras doadas por artistas locais. Toda a renda vai para os projetos educacionais.",
      status: "OPEN",
      antiSnipeSeconds: 120,
    },
  });
  for (const l of [
    { id: "seed-lot-1", title: "Quadro “Amanhecer”", start: 20000, inc: 5000 },
    { id: "seed-lot-2", title: "Escultura em madeira", start: 30000, inc: 5000 },
  ]) {
    await prisma.lot.upsert({
      where: { id: l.id },
      update: {},
      create: {
        id: l.id,
        auctionId: auction.id,
        organizationId: org.id,
        title: l.title,
        description: "Peça original, com certificado de autenticidade.",
        startPriceCents: l.start,
        minIncrementCents: l.inc,
        endsAt: new Date(Date.now() + 7 * 86_400_000),
        status: "ACTIVE",
      },
    });
  }
  const auctionCampaign = await prisma.campaign.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "leilao" } },
    update: {},
    create: { organizationId: org.id, slug: "leilao", title: auction.title, summary: auction.description, type: "DONATION", status: "PUBLISHED" },
  });
  const auctionBlocks = [
    { id: "a1", type: "hero", props: { title: auction.title, subtitle: auction.description, ctaLabel: "Ver lotes", ctaTarget: "url", ctaUrl: "#lotes", overlay: 0.4 } },
    { id: "a2", type: "auctionLots", props: { auctionId: auction.id, columns: 2 } },
  ];
  await prisma.page.upsert({
    where: { campaignId: auctionCampaign.id },
    update: {},
    create: { organizationId: org.id, campaignId: auctionCampaign.id, blocks: auctionBlocks, publishedBlocks: auctionBlocks, publishedAt: new Date() },
  });

  console.log(`Seed done.
  Demo campaign:   http://instituto-demo.localhost:3000/agua-limpa
  Apadrinhamento:  http://instituto-demo.localhost:3000/apadrinhe
  Rifa:            http://instituto-demo.localhost:3000/rifa
  Evento:          http://instituto-demo.localhost:3000/jantar
  Leilão:          http://instituto-demo.localhost:3000/leilao
  Panel login:     http://app.localhost:3000/login  (owner@demo.test / demo12345)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
