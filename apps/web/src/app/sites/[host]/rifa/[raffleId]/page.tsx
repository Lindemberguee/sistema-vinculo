import { createHash } from "node:crypto";
import { notFound } from "next/navigation";
import { prisma } from "@donation/db";
import { formatBRL } from "@donation/shared";
import { resolveTenant } from "@/server/tenant";
import { drawWinnerIndex } from "@/server/raffle/logic";
import { PublicShell } from "@/components/public/PublicShell";
import { Alert } from "@/components/ui";

export const dynamic = "force-dynamic";

/** "João S." — enough to recognise yourself, not enough to dox the winner. */
function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  const first = parts[0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]! : "";
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first;
}

export default async function RaffleResultPage({
  params,
}: {
  params: Promise<{ host: string; raffleId: string }>;
}) {
  const { host, raffleId } = await params;
  const tenant = await resolveTenant(decodeURIComponent(host));
  if (!tenant || tenant.kind !== "site") notFound();

  const raffle = await prisma.raffle.findFirst({
    where: { id: raffleId, organizationId: tenant.organizationId },
    select: {
      title: true,
      description: true,
      prize: true,
      ticketPriceCents: true,
      totalNumbers: true,
      drawAt: true,
      status: true,
      drawSeed: true,
      drawnNumber: true,
      drawnAt: true,
      winnerTicketId: true,
      campaign: { select: { slug: true, title: true } },
      organization: { select: { displayName: true, branding: true } },
    },
  });
  if (!raffle) notFound();

  const branding = (raffle.organization.branding ?? {}) as { logoUrl?: string; primaryColor?: string };
  const paidNumbers = (
    await prisma.raffleTicket.findMany({
      where: { raffleId, status: "PAID" },
      orderBy: { number: "asc" },
      select: { number: true },
    })
  ).map((t) => t.number);
  const paidCount = paidNumbers.length;

  const winnerDonor =
    raffle.status === "DRAWN" && raffle.winnerTicketId
      ? await prisma.raffleTicket
          .findFirst({ where: { id: raffle.winnerTicketId }, select: { donorId: true } })
          .then((t) => (t?.donorId ? prisma.donor.findUnique({ where: { id: t.donorId }, select: { name: true } }) : null))
      : null;

  // Auditable digest of the exact pool that was drawn from. Skip for huge pools.
  const poolHash =
    paidCount > 0 && paidCount <= 200_000
      ? createHash("sha256").update(paidNumbers.join(",")).digest("hex")
      : null;
  const winnerIndex =
    raffle.status === "DRAWN" && raffle.drawSeed && paidCount > 0
      ? drawWinnerIndex(raffle.drawSeed, paidCount)
      : null;

  return (
    <PublicShell
      org={{ displayName: raffle.organization.displayName, logoUrl: branding.logoUrl, accent: branding.primaryColor }}
      width="sm"
    >
      <p className="eyebrow">Rifa</p>
      <h1 className="mt-1 text-xl font-semibold tracking-tight">{raffle.title}</h1>
      <p className="mt-1 text-sm text-muted">
        Prêmio: {raffle.prize} · {formatBRL(raffle.ticketPriceCents)}/número
      </p>

      {raffle.status === "DRAWN" ? (
        <>
          <div className="mt-6 rounded-2xl border border-line bg-surface p-5 text-center">
            <div className="eyebrow">Número sorteado</div>
            <div className="mt-1 text-4xl font-semibold tabular-nums">{raffle.drawnNumber}</div>
            {winnerDonor && <div className="mt-2 text-sm text-muted">Ganhador(a): {maskName(winnerDonor.name)}</div>}
            <div className="mt-1 text-xs text-faint">
              Sorteado em {raffle.drawnAt?.toLocaleString("pt-BR")}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-line bg-canvas p-4 text-xs text-muted">
            <div className="mb-2 font-semibold text-ink">Como conferir</div>
            <p>
              O sorteio é determinístico: <code>índice = sha256(semente) mod nº de números pagos</code>, com os números
              pagos ordenados de forma crescente. Qualquer pessoa com os dados abaixo chega ao mesmo resultado.
            </p>
            <dl className="mt-3 space-y-1">
              <div className="flex justify-between gap-3">
                <dt>Números pagos</dt>
                <dd className="tabular-nums">{paidCount}</dd>
              </div>
              {winnerIndex != null && (
                <div className="flex justify-between gap-3">
                  <dt>Índice sorteado</dt>
                  <dd className="tabular-nums">{winnerIndex}</dd>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <dt>Semente</dt>
                <dd className="break-all font-mono text-2xs text-ink">{raffle.drawSeed}</dd>
              </div>
              {poolHash && (
                <div className="flex flex-col gap-1">
                  <dt>SHA-256 da lista de números pagos</dt>
                  <dd className="break-all font-mono text-2xs">{poolHash}</dd>
                </div>
              )}
            </dl>
          </div>
        </>
      ) : raffle.status === "CLOSED" ? (
        <div className="mt-6">
          <Alert tone="warn">
            Vendas encerradas. O sorteio será realizado
            {raffle.drawAt ? ` em ${raffle.drawAt.toLocaleString("pt-BR")}` : " em breve"}. Esta página mostrará o
            resultado e a semente para conferência.
          </Alert>
        </div>
      ) : raffle.status === "CANCELED" ? (
        <div className="mt-6">
          <Alert tone="warn">Esta rifa foi cancelada.</Alert>
        </div>
      ) : (
        <div className="mt-6">
          <Alert tone="success">
            Rifa aberta — {paidCount} de {raffle.totalNumbers} números vendidos.
            {raffle.drawAt ? ` Sorteio em ${raffle.drawAt.toLocaleString("pt-BR")}.` : ""}
          </Alert>
          {raffle.campaign?.slug && (
            <p className="mt-3 text-sm">
              <a className="link" href={`/${raffle.campaign.slug}#checkout`}>
                Comprar números na página da campanha →
              </a>
            </p>
          )}
        </div>
      )}
    </PublicShell>
  );
}
