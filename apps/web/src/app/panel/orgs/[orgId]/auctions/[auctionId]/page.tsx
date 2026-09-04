import { notFound } from "next/navigation";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { AuctionForm } from "@/components/AuctionForm";
import { AuctionStatusControls, LotManager } from "@/components/AuctionControls";
import { PublicLinkCard } from "@/components/panel/PublicLinkCard";
import { PageHeader, Card, CardBody, StatusBadge } from "@/components/ui";

export default async function AuctionDetail({
  params,
}: {
  params: Promise<{ orgId: string; auctionId: string }>;
}) {
  const { orgId, auctionId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "EDITOR");

  const [auction, campaigns] = await Promise.all([
    db.auction.findFirst({
      where: { id: auctionId },
      select: {
        title: true,
        description: true,
        antiSnipeSeconds: true,
        campaignId: true,
        status: true,
        organization: { select: { slug: true } },
        lots: {
          orderBy: { endsAt: "asc" },
          select: {
            id: true,
            title: true,
            description: true,
            photoUrl: true,
            startPriceCents: true,
            minIncrementCents: true,
            endsAt: true,
            status: true,
            bidCount: true,
            currentBidCents: true,
            winningBidCents: true,
          },
        },
      },
    }),
    db.campaign.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  if (!auction) notFound();

  return (
    <>
      <PageHeader
        title={auction.title}
        back={{ href: `/orgs/${orgId}/auctions`, label: "Leilões" }}
        actions={<StatusBadge status={auction.status} />}
      />

      <div className="grid gap-4">
        <Card>
          <CardBody>
            <h2 className="mb-2 text-sm font-semibold">Status</h2>
            <AuctionStatusControls orgId={orgId} auctionId={auctionId} status={auction.status} />
          </CardBody>
        </Card>

        <PublicLinkCard
          orgSlug={auction.organization.slug}
          path={`/leilao/${auctionId}`}
          note="Link direto pros lances — funciona sem montar página de campanha."
        />

        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold">Lotes</h2>
            <LotManager
              orgId={orgId}
              auctionId={auctionId}
              lots={auction.lots.map((l) => ({ ...l, endsAt: l.endsAt.toISOString() }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold">Dados do leilão</h2>
            <AuctionForm
              orgId={orgId}
              auctionId={auctionId}
              campaigns={campaigns}
              initial={{
                title: auction.title,
                description: auction.description,
                antiSnipeSeconds: String(auction.antiSnipeSeconds),
                campaignId: auction.campaignId ?? "",
              }}
            />
            <p className="mt-2 hint">
              ID do leilão (use no bloco “Leilão”): <code>{auctionId}</code>
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
