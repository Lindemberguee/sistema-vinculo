import { notFound } from "next/navigation";
import { formatBRL } from "@donation/shared";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { env } from "@/env";
import { RaffleForm } from "@/components/RaffleForm";
import { RaffleStatusControls, RaffleDrawForm } from "@/components/RaffleControls";
import { CopyButton } from "@/components/public/CopyButton";
import { PageHeader, Card, CardBody, StatusBadge, Stat } from "@/components/ui";

const toLocalInput = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const centsToReais = (n: number) => (n / 100).toString().replace(".", ",");

export default async function RaffleDetail({
  params,
}: {
  params: Promise<{ orgId: string; raffleId: string }>;
}) {
  const { orgId, raffleId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "EDITOR");

  const [raffle, campaigns] = await Promise.all([
    db.raffle.findFirst({
      where: { id: raffleId },
      select: {
        title: true,
        description: true,
        prize: true,
        ticketPriceCents: true,
        totalNumbers: true,
        minPerPurchase: true,
        maxPerPurchase: true,
        drawAt: true,
        campaignId: true,
        status: true,
        drawSeed: true,
        drawnNumber: true,
        drawnAt: true,
        winnerTicketId: true,
        organization: { select: { slug: true } },
      },
    }),
    db.campaign.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  if (!raffle) notFound();

  const [paid, reserved] = await Promise.all([
    db.raffleTicket.count({ where: { raffleId, status: "PAID" } }),
    db.raffleTicket.count({ where: { raffleId, status: "RESERVED" } }),
  ]);

  const winnerTicket = raffle.winnerTicketId
    ? await db.raffleTicket.findFirst({
        where: { id: raffle.winnerTicketId },
        select: { number: true, donorId: true },
      })
    : null;
  const winnerDonor = winnerTicket?.donorId
    ? await db.donor.findFirst({ where: { id: winnerTicket.donorId }, select: { name: true, email: true } })
    : null;

  const revenueCents = paid * raffle.ticketPriceCents;
  const sc = env.APP_BASE_DOMAIN.includes("localhost") ? "http" : "https";
  const resultUrl = `${sc}://${raffle.organization.slug}.${env.APP_BASE_DOMAIN}/rifa/${raffleId}`;
  const showResultUrl = raffle.status === "DRAWN" || raffle.status === "CLOSED";

  return (
    <>
      <PageHeader
        title={raffle.title}
        back={{ href: `/orgs/${orgId}/raffles`, label: "Rifas" }}
        actions={<StatusBadge status={raffle.status} />}
      />

      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Números pagos" value={`${paid} / ${raffle.totalNumbers}`} />
          <Stat label="Reservados agora" value={reserved} />
          <Stat label="Arrecadado" value={formatBRL(revenueCents)} />
          <Stat label="Preço" value={formatBRL(raffle.ticketPriceCents)} />
        </div>

        <Card>
          <CardBody>
            <h2 className="mb-2 text-sm font-semibold">Status</h2>
            <RaffleStatusControls orgId={orgId} raffleId={raffleId} status={raffle.status} />
          </CardBody>
        </Card>

        {raffle.status === "DRAWN" ? (
          <Card>
            <CardBody>
              <h2 className="mb-1 text-sm font-semibold">Resultado</h2>
              <p className="text-sm">
                Número sorteado: <strong>{raffle.drawnNumber}</strong>
                {winnerDonor && (
                  <>
                    {" "}
                    — {winnerDonor.name} <span className="text-muted">({winnerDonor.email})</span>
                  </>
                )}
              </p>
              <p className="mt-1 hint">
                Semente: <code>{raffle.drawSeed}</code> · sorteado em {raffle.drawnAt?.toLocaleString("pt-BR")}
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody>
              <h2 className="mb-2 text-sm font-semibold">Sorteio</h2>
              {raffle.status === "CLOSED" ? (
                <RaffleDrawForm orgId={orgId} raffleId={raffleId} drawSeed={raffle.drawSeed} />
              ) : (
                <p className="hint">
                  Feche as vendas para liberar o sorteio
                  {raffle.drawAt ? " (ou aguarde a data do sorteio — a rifa fecha sozinha)" : ""}.
                </p>
              )}
            </CardBody>
          </Card>
        )}

        {showResultUrl && (
          <Card>
            <CardBody>
              <h2 className="mb-1 text-sm font-semibold">Página pública</h2>
              <p className="hint mb-2">Link do resultado (com a semente para conferência). Compartilhe com os participantes.</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-canvas px-2.5 py-1.5 text-xs">{resultUrl}</code>
                <CopyButton text={resultUrl} label="Copiar" />
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold">Dados da rifa</h2>
            <RaffleForm
              orgId={orgId}
              raffleId={raffleId}
              campaigns={campaigns}
              locked={raffle.status !== "DRAFT"}
              initial={{
                title: raffle.title,
                description: raffle.description,
                prize: raffle.prize,
                priceReais: centsToReais(raffle.ticketPriceCents),
                totalNumbers: String(raffle.totalNumbers),
                minPerPurchase: String(raffle.minPerPurchase),
                maxPerPurchase: String(raffle.maxPerPurchase),
                drawAt: toLocalInput(raffle.drawAt),
                campaignId: raffle.campaignId ?? "",
              }}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
