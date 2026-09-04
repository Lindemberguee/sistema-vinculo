import type { ReactNode } from "react";
import type { Block } from "@donation/blocks";
import { prisma } from "@donation/db";
import type { RenderContext } from "./context";
import { renderStaticBlock, STATIC_TYPES, type StaticCtx } from "./render-static";
import { resolveAccent } from "./accent";
import { sanitizeRichText } from "./sanitize";
import { DonationCheckout } from "./DonationCheckout";
import { RaffleWidget } from "./RaffleWidget";
import { EventCheckout } from "./EventCheckout";
import { AuctionLots } from "./AuctionLots";
import { IntlDonationForm } from "./IntlDonationForm";
import { Countdown } from "./Countdown";
import { PixKeyCard } from "./PixKeyCard";
import { minNextBidCents } from "@/server/auction/logic";
import { isIntlEnabled } from "@/env";

const brl = (c: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);

/** Neutral inline message for a block that can't render (misconfig / empty). */
function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mx-auto max-w-md rounded-lg border border-dashed border-line-strong px-6 py-5 text-center text-sm text-muted">
      {children}
    </p>
  );
}

/** Renders a validated Block[] for the public campaign page. */
export function BlockList({ blocks, ctx }: { blocks: Block[]; ctx: RenderContext }) {
  return (
    <>
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} ctx={ctx} />
      ))}
    </>
  );
}

function BlockView({ block, ctx }: { block: Block; ctx: RenderContext }): ReactNode {
  const accent = ctx.org.branding.primaryColor ?? "#006B4F";

  if (STATIC_TYPES.has(block.type)) {
    const sctx: StaticCtx = {
      accent,
      radius: ctx.org.branding.buttonRadius ?? "full",
      raisedCents: ctx.campaign.raisedCents,
      goalCents: ctx.campaign.goalCents,
      donorsCount: ctx.campaign.donorsCount,
      forcePlatformBranding: !ctx.removeBranding,
    };
    return renderStaticBlock(block, sctx);
  }

  switch (block.type) {
    case "countdown":
      return (
        <Countdown
          title={block.props.title}
          deadline={block.props.deadline}
          endedLabel={block.props.endedLabel}
          accent={accent}
        />
      );

    case "pixKey":
      return (
        <PixKeyCard
          title={block.props.title}
          keyType={block.props.keyType}
          keyValue={block.props.keyValue}
          note={block.props.note}
          accent={accent}
        />
      );

    case "donationCheckout":
      return (
        <DonationCheckoutBlock
          ctx={ctx}
          accent={accent}
          methods={block.props.methods}
          allowRecurring={block.props.allowRecurring && ctx.campaign.allowRecurring}
          allowTip={block.props.allowTip && ctx.campaign.allowTip}
          tipLabel={block.props.tipLabel}
          dedicationEnabled={ctx.campaign.dedicationEnabled}
        />
      );

    case "sponseeGrid":
      return (
        <SponseeGrid
          ctx={ctx}
          title={block.props.title}
          category={block.props.category}
          columns={block.props.columns}
          showStory={block.props.showStory}
          accent={accent}
        />
      );

    case "raffleWidget":
      return <RaffleBlock ctx={ctx} raffleId={block.props.raffleId} quickAmounts={block.props.quickAmounts} allowPickNumbers={block.props.allowPickNumbers} accent={accent} />;

    case "eventTickets":
      return <EventBlock ctx={ctx} eventId={block.props.eventId} askAttendeeNames={block.props.askAttendeeNames} accent={accent} />;

    case "auctionLots":
      return <AuctionBlock ctx={ctx} auctionId={block.props.auctionId} columns={block.props.columns} accent={accent} />;

    case "intlDonation":
      if (!isIntlEnabled) return null;
      return (
        <div className="flex justify-center px-4 py-8">
          <IntlDonationForm
            campaignSlug={ctx.campaign.slug}
            title={block.props.title}
            currencies={block.props.currencies}
            suggestedAmounts={block.props.suggestedAmounts}
            accentColor={accent}
          />
        </div>
      );

    case "donorWall":
      return <DonorWall ctx={ctx} limit={block.props.limit} showAmount={block.props.showAmount} />;

    case "campaignUpdates":
      return <CampaignUpdates ctx={ctx} title={block.props.title} limit={block.props.limit} />;

    case "campaignReports":
      return <CampaignReports ctx={ctx} title={block.props.title} />;

    case "rewards":
      return <CampaignRewards ctx={ctx} title={block.props.title} accent={accent} />;

    case "ambassadorLeaderboard":
      if (!ctx.campaign.allowAmbassadors) return null;
      return (
        <AmbassadorLeaderboard
          ctx={ctx}
          title={block.props.title}
          limit={block.props.limit}
          showJoinCta={block.props.showJoinCta}
          accent={accent}
        />
      );

    default:
      return null;
  }
}

async function AmbassadorLeaderboard({
  ctx,
  title,
  limit,
  showJoinCta,
  accent,
}: {
  ctx: RenderContext;
  title: string;
  limit: number;
  showJoinCta: boolean;
  accent: string;
}) {
  const rows = await prisma.campaignAmbassador.findMany({
    where: { organizationId: ctx.organizationId, campaign: { slug: ctx.campaign.slug }, status: "ACTIVE" },
    orderBy: [{ raisedCents: "desc" }, { createdAt: "asc" }],
    take: Math.min(Math.max(limit, 1), 20),
    select: { slug: true, name: true, headline: true, photoUrl: true, raisedCents: true, goalCents: true },
  });
  const joinHref = `/${ctx.campaign.slug}/embaixador`;
  const ink = resolveAccent(accent).textInk;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        {showJoinCta && (
          <a href={joinHref} className="text-sm font-medium" style={{ color: ink }}>
            Seja um embaixador →
          </a>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-8 text-center">
          <p className="text-sm text-muted">Ninguém arrecadando ainda. Que tal ser o primeiro?</p>
          {showJoinCta && (
            <a
              href={joinHref}
              className="mt-3 inline-block rounded-full px-5 py-2.5 text-sm font-medium text-white"
              style={{ background: accent }}
            >
              Criar minha página
            </a>
          )}
        </div>
      ) : (
        <ol className="space-y-2">
          {rows.map((a, i) => {
            const pct = a.goalCents && a.goalCents > 0 ? Math.min(100, Math.round((a.raisedCents / a.goalCents) * 100)) : null;
            return (
              <li key={a.slug}>
                <a
                  href={`/embaixador/${a.slug}`}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-shadow hover:shadow-card"
                >
                  <span className="w-5 shrink-0 text-center text-sm font-semibold text-faint">{i + 1}</span>
                  {a.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.photoUrl} alt={a.name} className="size-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas text-xs font-semibold text-muted">
                      {a.name.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.name}</span>
                    {a.headline && <span className="block truncate text-xs text-muted">{a.headline}</span>}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums" style={{ color: ink }}>
                      {brl(a.raisedCents)}
                    </span>
                    {pct != null && <span className="block text-xs text-muted">{pct}% da meta</span>}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

async function CampaignRewards({ ctx, title, accent }: { ctx: RenderContext; title: string; accent: string }) {
  const ink = resolveAccent(accent).textInk;
  const rows = await prisma.campaignReward.findMany({
    where: { organizationId: ctx.organizationId, campaign: { slug: ctx.campaign.slug } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true, description: true, imageUrl: true, amountCents: true, quantity: true, claimed: true },
  });
  if (rows.length === 0) return null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h2 className="mb-5 text-xl font-semibold">{title}</h2>
      <div className="grid gap-4 @md:grid-cols-2 @2xl:grid-cols-3">
        {rows.map((r) => {
          const remaining = r.quantity == null ? null : Math.max(0, r.quantity - r.claimed);
          const soldOut = remaining === 0;
          return (
            <div
              key={r.id}
              className={`flex flex-col overflow-hidden rounded-2xl border border-line bg-surface ${soldOut ? "opacity-60" : ""}`}
            >
              {r.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imageUrl} alt={r.title} className="h-36 w-full object-cover" />
              )}
              <div className="flex flex-1 flex-col p-4">
                <div className="text-lg font-semibold" style={{ color: ink }}>
                  {brl(r.amountCents)}
                </div>
                <div className="mt-0.5 font-medium">{r.title}</div>
                {r.description && <p className="mt-1 flex-1 text-sm text-muted">{r.description}</p>}
                <div className="mt-3 flex items-center justify-between">
                  {soldOut ? (
                    <span className="text-xs font-medium text-danger">Esgotada</span>
                  ) : (
                    <span className="text-xs text-muted">{remaining != null ? `${remaining} restantes` : ""}</span>
                  )}
                  {!soldOut && (
                    <a href="#checkout" className="text-sm font-medium" style={{ color: ink }}>
                      Escolher →
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

async function DonationCheckoutBlock({
  ctx,
  accent,
  methods,
  allowRecurring,
  allowTip,
  tipLabel,
  dedicationEnabled,
}: {
  ctx: RenderContext;
  accent: string;
  methods: ("PIX" | "CREDIT_CARD" | "BOLETO")[];
  allowRecurring: boolean;
  allowTip: boolean;
  tipLabel: string;
  dedicationEnabled: boolean;
}) {
  const rewardRows = await prisma.campaignReward.findMany({
    where: { organizationId: ctx.organizationId, campaign: { slug: ctx.campaign.slug } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true, description: true, amountCents: true, quantity: true, claimed: true },
  });
  const rewards = rewardRows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    amountCents: r.amountCents,
    remaining: r.quantity == null ? null : Math.max(0, r.quantity - r.claimed),
  }));

  return (
    <div className="flex justify-center px-4 py-8">
      <DonationCheckout
        campaignSlug={ctx.campaign.slug}
        minAmountCents={ctx.campaign.minAmountCents}
        suggestedAmountsCents={ctx.campaign.suggestedAmountsCents}
        methods={methods}
        allowRecurring={allowRecurring}
        allowTip={allowTip}
        tipLabel={tipLabel}
        platformFeeBps={ctx.platformFeeBps}
        pagarmePublicKey={ctx.pagarmePublicKey}
        accentColor={accent}
        rewards={rewards.length ? rewards : undefined}
        dedicationEnabled={dedicationEnabled}
        preview={ctx.host === "preview"}
      />
    </div>
  );
}

async function CampaignReports({ ctx, title }: { ctx: RenderContext; title: string }) {
  const reports = await prisma.campaignReport.findMany({
    where: { organizationId: ctx.organizationId, campaign: { slug: ctx.campaign.slug } },
    orderBy: { publishedAt: "desc" },
    take: 20,
    select: { id: true, title: true, url: true, publishedAt: true },
  });
  if (reports.length === 0) return null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h2 className="mb-1 text-lg font-semibold">{title}</h2>
      <p className="mb-4 text-sm text-muted">Como os recursos arrecadados foram usados.</p>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {reports.map((r) => (
          <li key={r.id}>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-canvas"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{r.title}</span>
                <span className="text-xs text-muted">{r.publishedAt.toLocaleDateString("pt-BR")}</span>
              </span>
              <span className="shrink-0 text-brand-600">Abrir ↗</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function CampaignUpdates({ ctx, title, limit }: { ctx: RenderContext; title: string; limit: number }) {
  const updates = await prisma.campaignUpdate.findMany({
    where: { organizationId: ctx.organizationId, campaign: { slug: ctx.campaign.slug } },
    orderBy: { publishedAt: "desc" },
    take: Math.min(limit, 20),
    select: { id: true, title: true, body: true, publishedAt: true },
  });
  if (updates.length === 0) return null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h2 className="mb-5 text-xl font-semibold">{title}</h2>
      <ol className="space-y-6 border-l border-line pl-5">
        {updates.map((u) => (
          <li key={u.id} className="relative">
            <span
              className="absolute -left-[1.4rem] top-1 size-2 rounded-full"
              style={{ background: ctx.org.branding.primaryColor ?? "#006B4F" }}
            />
            <time className="text-xs text-muted">{u.publishedAt.toLocaleDateString("pt-BR")}</time>
            <h3 className="mt-0.5 font-semibold">{u.title}</h3>
            <div
              className="prose-sm mt-1 text-sm leading-relaxed text-muted [&_a]:text-brand-600 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(u.body) }}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

async function SponseeGrid({
  ctx,
  title,
  category,
  columns,
  showStory,
  accent,
}: {
  ctx: RenderContext;
  title: string;
  category?: string;
  columns: number;
  showStory: boolean;
  accent: string;
}) {
  const sponsees = await prisma.sponsee.findMany({
    where: { organizationId: ctx.organizationId, status: "AVAILABLE", ...(category ? { category } : {}) },
    orderBy: { createdAt: "asc" },
    take: 60,
    select: { id: true, name: true, category: true, story: true, photoUrl: true, birthYear: true, monthlyAmountCents: true },
  });

  const radius = ctx.org.branding.buttonRadius ?? "full";
  const btnR = radius === "full" ? "rounded-full" : radius === "none" ? "rounded-none" : "rounded-lg";
  const { onAccent: fg, textInk: ink } = resolveAccent(accent);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h2 className="mb-1 text-xl font-semibold">{title}</h2>
      <p className="mb-5 text-sm text-muted">
        {sponsees.length} {sponsees.length === 1 ? "afilhado aguarda" : "afilhados aguardam"} um padrinho.
      </p>
      {sponsees.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-6 py-8 text-center text-sm text-muted">
          Todos os afilhados já têm padrinho no momento. Volte em breve.
        </p>
      ) : (
        <div
          className="grid grid-cols-1 gap-4 @md:grid-cols-2 @xl:[grid-template-columns:repeat(var(--gcols),minmax(0,1fr))]"
          style={{ ["--gcols" as string]: String(columns) }}
        >
          {sponsees.map((s) => (
            <div
              key={s.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-card"
            >
              <div className="relative aspect-[4/3] w-full bg-canvas">
                {s.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.photoUrl} alt={s.name} className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center text-2xl font-semibold text-faint">
                    {s.name.trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-2 py-0.5 text-[0.6875rem] font-medium text-muted backdrop-blur">
                  {s.category}
                  {s.birthYear ? ` · ${new Date().getFullYear() - s.birthYear} anos` : ""}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="font-semibold">{s.name}</div>
                {showStory && <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted">{s.story}</p>}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-sm">
                    <span className="font-semibold" style={{ color: ink }}>
                      {brl(s.monthlyAmountCents)}
                    </span>
                    <span className="text-muted">/mês</span>
                  </span>
                  <a
                    href={`/${ctx.campaign.slug}/apadrinhar/${s.id}`}
                    className={`${btnR} px-4 py-2 text-sm font-medium no-underline`}
                    style={{ background: accent, color: fg }}
                  >
                    Apadrinhar
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function RaffleBlock({
  ctx,
  raffleId,
  quickAmounts,
  allowPickNumbers,
  accent,
}: {
  ctx: RenderContext;
  raffleId: string;
  quickAmounts: number[];
  allowPickNumbers: boolean;
  accent: string;
}) {
  if (!raffleId) return <Notice>Rifa não configurada.</Notice>;

  const raffle = await prisma.raffle.findFirst({
    where: { id: raffleId, organizationId: ctx.organizationId },
    select: {
      id: true,
      title: true,
      prize: true,
      status: true,
      ticketPriceCents: true,
      totalNumbers: true,
      minPerPurchase: true,
      maxPerPurchase: true,
      drawnNumber: true,
    },
  });
  if (!raffle) return <Notice>Rifa não encontrada.</Notice>;

  const soldCount = await prisma.raffleTicket.count({
    where: { raffleId: raffle.id, status: { in: ["RESERVED", "PAID"] } },
  });

  return (
    <div className="flex justify-center px-4 py-8">
      <RaffleWidget
        raffleId={raffle.id}
        title={raffle.title}
        prize={raffle.prize}
        ticketPriceCents={raffle.ticketPriceCents}
        totalNumbers={raffle.totalNumbers}
        soldCount={soldCount}
        minPerPurchase={raffle.minPerPurchase}
        maxPerPurchase={raffle.maxPerPurchase}
        status={raffle.status}
        quickAmounts={quickAmounts}
        allowPickNumbers={allowPickNumbers}
        allowTip={ctx.campaign.allowTip}
        tipLabel="Adicionar uma contribuição extra à causa"
        platformFeeBps={ctx.platformFeeBps}
        pagarmePublicKey={ctx.pagarmePublicKey}
        accentColor={accent}
      />
    </div>
  );
}

async function EventBlock({
  ctx,
  eventId,
  askAttendeeNames,
  accent,
}: {
  ctx: RenderContext;
  eventId: string;
  askAttendeeNames: boolean;
  accent: string;
}) {
  if (!eventId) return <Notice>Evento não configurado.</Notice>;
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: ctx.organizationId },
    select: {
      id: true,
      title: true,
      venue: true,
      startsAt: true,
      status: true,
      ticketTypes: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, priceCents: true, quantity: true, sold: true, maxPerOrder: true } },
    },
  });
  if (!event) return <Notice>Evento não encontrado.</Notice>;

  if (event.status !== "PUBLISHED") {
    return (
      <Notice>
        {event.title} — {event.status === "ENDED" ? "vendas encerradas" : "vendas não abertas"}.
      </Notice>
    );
  }

  return (
    <div className="flex justify-center px-4 py-8">
      <EventCheckout
        eventId={event.id}
        eventTitle={event.title}
        venue={event.venue}
        startsAtLabel={event.startsAt.toLocaleString("pt-BR")}
        askAttendeeNames={askAttendeeNames}
        ticketTypes={event.ticketTypes.map((t) => ({
          id: t.id,
          name: t.name,
          priceCents: t.priceCents,
          available: Math.max(0, t.quantity - t.sold),
          maxPerOrder: t.maxPerOrder,
        }))}
        allowTip={ctx.campaign.allowTip}
        tipLabel="Adicionar uma contribuição extra à causa"
        platformFeeBps={ctx.platformFeeBps}
        pagarmePublicKey={ctx.pagarmePublicKey}
        accentColor={accent}
      />
    </div>
  );
}

async function AuctionBlock({
  ctx,
  auctionId,
  columns,
  accent,
}: {
  ctx: RenderContext;
  auctionId: string;
  columns: number;
  accent: string;
}) {
  if (!auctionId) return <Notice>Leilão não configurado.</Notice>;
  const auction = await prisma.auction.findFirst({
    where: { id: auctionId, organizationId: ctx.organizationId },
    select: {
      status: true,
      lots: {
        where: { status: "ACTIVE" },
        orderBy: { endsAt: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          photoUrl: true,
          startPriceCents: true,
          minIncrementCents: true,
          currentBidCents: true,
          bidCount: true,
          endsAt: true,
          status: true,
        },
      },
    },
  });
  if (!auction) return <Notice>Leilão não encontrado.</Notice>;
  if (auction.status !== "OPEN" || auction.lots.length === 0) {
    return <Notice>Nenhum lote disponível no momento.</Notice>;
  }

  return (
    <AuctionLots
      columns={columns}
      accent={accent}
      lots={auction.lots.map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        photoUrl: l.photoUrl,
        startPriceCents: l.startPriceCents,
        minIncrementCents: l.minIncrementCents,
        currentBidCents: l.currentBidCents,
        minNextCents: minNextBidCents(l.currentBidCents, l.startPriceCents, l.minIncrementCents),
        bidCount: l.bidCount,
        endsAt: l.endsAt.toISOString(),
        status: l.status,
      }))}
    />
  );
}

async function DonorWall({ ctx, limit, showAmount }: { ctx: RenderContext; limit: number; showAmount: boolean }) {
  const { wash, textInk: ink } = resolveAccent(ctx.org.branding.primaryColor);
  const [donations, total] = await Promise.all([
    prisma.donation.findMany({
      where: { organizationId: ctx.organizationId, status: "PAID", anonymous: false },
      orderBy: { paidAt: "desc" },
      take: limit,
      select: { id: true, amountCents: true, donor: { select: { name: true } } },
    }),
    prisma.donation.count({ where: { organizationId: ctx.organizationId, status: "PAID" } }),
  ]);

  if (donations.length === 0) return null;
  const extra = total - donations.length;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h3 className="text-lg font-semibold">Quem já apoiou</h3>
      <p className="mt-0.5 text-sm text-muted">{total} doações confirmadas até agora.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {donations.map((d) => {
          const first = d.donor.name.trim().split(/\s+/)[0] ?? "Doador";
          return (
            <span
              key={d.id}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm"
            >
              <span
                className="grid size-6 place-items-center rounded-full text-[0.625rem] font-semibold"
                style={{ background: wash, color: ink }}
              >
                {first.charAt(0).toUpperCase()}
              </span>
              {first}
              {showAmount && <span className="text-xs text-muted">{brl(d.amountCents)}</span>}
            </span>
          );
        })}
        {extra > 0 && (
          <span className="inline-flex items-center rounded-full bg-canvas px-3 py-1.5 text-sm text-muted">
            +{extra} {extra === 1 ? "outra pessoa" : "outras pessoas"}
          </span>
        )}
      </div>
    </div>
  );
}
