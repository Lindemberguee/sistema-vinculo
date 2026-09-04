import { notFound } from "next/navigation";
import { prisma } from "@donation/db";
import { resolveTenant } from "@/server/tenant";
import { DEFAULT_ACCENT } from "@/blocks/accent";
import { minNextBidCents } from "@/server/auction/logic";
import { PublicShell } from "@/components/public/PublicShell";
import { AuctionLots } from "@/blocks/AuctionLots";
import { Alert } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ host: string; auctionId: string }> }) {
  const { host, auctionId } = await params;
  const tenant = await resolveTenant(decodeURIComponent(host));
  if (!tenant || tenant.kind !== "site") return {};
  const a = await prisma.auction.findFirst({
    where: { id: auctionId, organizationId: tenant.organizationId },
    select: { title: true, description: true },
  });
  return a ? { title: a.title, description: a.description.slice(0, 160) } : {};
}

export default async function PublicAuctionPage({
  params,
}: {
  params: Promise<{ host: string; auctionId: string }>;
}) {
  const { host, auctionId } = await params;
  const tenant = await resolveTenant(decodeURIComponent(host));
  if (!tenant || tenant.kind !== "site") notFound();

  const auction = await prisma.auction.findFirst({
    where: { id: auctionId, organizationId: tenant.organizationId },
    select: {
      title: true,
      description: true,
      status: true,
      organization: { select: { displayName: true, branding: true } },
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
  if (!auction) notFound();

  const branding = (auction.organization.branding ?? {}) as { logoUrl?: string; primaryColor?: string };
  const accent = branding.primaryColor ?? DEFAULT_ACCENT;
  const open = auction.status === "OPEN" && auction.lots.length > 0;

  return (
    <PublicShell
      org={{ displayName: auction.organization.displayName, logoUrl: branding.logoUrl, accent }}
      width="lg"
    >
      <p className="eyebrow">Leilão beneficente</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{auction.title}</h1>
      {auction.description && (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">{auction.description}</p>
      )}

      {open ? (
        <AuctionLots
          columns={2}
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
      ) : (
        <div className="mt-6">
          <Alert tone="warn">
            {auction.status === "OPEN"
              ? "Nenhum lote disponível no momento."
              : "Este leilão não está aberto para lances."}
          </Alert>
        </div>
      )}
    </PublicShell>
  );
}
