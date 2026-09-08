import { createHash } from "node:crypto";
import { prisma, renderOrgEmail, resolveOrgSender } from "@donation/db";
import { ConflictError, ForbiddenError, formatBRL, NotFoundError, ValidationError } from "@donation/shared";
import { sendEmail } from "@donation/emails";
import { orgPublicOrigin } from "@/server/links/url";
import { extendedEndsAt, minNextBidCents, validateBid } from "./logic";

export interface PlaceBidParams {
  organizationId: string;
  lotId: string;
  amountCents: number;
  donor: { name: string; email: string; document?: string; phone?: string };
  consent: { email: boolean; whatsapp: boolean };
  ip: string;
}

export async function placeBid(params: PlaceBidParams) {
  const lot = await prisma.lot.findFirst({
    where: { id: params.lotId, organizationId: params.organizationId },
    select: {
      id: true,
      title: true,
      status: true,
      startPriceCents: true,
      minIncrementCents: true,
      currentBidCents: true,
      currentBidderDonorId: true,
      bidCount: true,
      endsAt: true,
      auction: { select: { status: true, antiSnipeSeconds: true, campaign: { select: { slug: true } } } },
    },
  });
  if (!lot) throw new NotFoundError("Lot");
  if (lot.auction.status !== "OPEN" || lot.status !== "ACTIVE") throw new ForbiddenError("Lote não está aceitando lances");
  const now = new Date();
  if (now >= lot.endsAt) throw new ForbiddenError("O tempo deste lote acabou");

  const min = minNextBidCents(lot.currentBidCents, lot.startPriceCents, lot.minIncrementCents);
  const v = validateBid(params.amountCents, min);
  if (!v.ok) throw new ValidationError(v.reason);

  const documentHash = params.donor.document
    ? createHash("sha256").update(params.donor.document.replace(/\D/g, "")).digest("hex")
    : undefined;
  const donor = await prisma.donor.upsert({
    where: { organizationId_email: { organizationId: params.organizationId, email: params.donor.email.toLowerCase() } },
    create: {
      organizationId: params.organizationId,
      email: params.donor.email.toLowerCase(),
      name: params.donor.name,
      phone: params.donor.phone,
      documentHash,
      consent: { ...params.consent, at: now.toISOString(), source: "auction", ip: params.ip },
    },
    update: { name: params.donor.name, phone: params.donor.phone ?? undefined, documentHash: documentHash ?? undefined },
    select: { id: true },
  });

  const prevBidderDonorId = lot.currentBidderDonorId;
  const ext = extendedEndsAt(lot.endsAt, now, lot.auction.antiSnipeSeconds);

  await prisma.$transaction(async (tx) => {
    // Optimistic lock on the exact current bid value.
    const claim = await tx.lot.updateMany({
      where: {
        id: lot.id,
        status: "ACTIVE",
        endsAt: { gt: now },
        currentBidCents: lot.currentBidCents ?? null,
      },
      data: {
        currentBidCents: params.amountCents,
        currentBidderDonorId: donor.id,
        bidCount: { increment: 1 },
        ...(ext ? { endsAt: ext } : {}),
      },
    });
    if (claim.count === 0) throw new ConflictError("Seu lance foi superado. Recarregue e tente de novo.");

    await tx.bid.updateMany({ where: { lotId: lot.id, outbid: false }, data: { outbid: true } });
    await tx.bid.create({
      data: { lotId: lot.id, organizationId: params.organizationId, donorId: donor.id, amountCents: params.amountCents, outbid: false },
    });
  });

  // Notify the person who just lost the top spot.
  if (prevBidderDonorId && prevBidderDonorId !== donor.id) {
    const prev = await prisma.donor.findUnique({ where: { id: prevBidderDonorId }, select: { name: true, email: true } });
    const org = await prisma.organization.findUnique({ where: { id: params.organizationId }, select: { displayName: true, slug: true } });
    if (prev && org) {
      const bidUrl = `${orgPublicOrigin({ slug: org.slug })}${lot.auction.campaign?.slug ? `/${lot.auction.campaign.slug}` : ""}`;
      const [sender, email] = await Promise.all([
        resolveOrgSender(params.organizationId),
        renderOrgEmail(params.organizationId, "AUCTION_OUTBID", {
          NOME: prev.name.trim().split(/\s+/)[0] || prev.name,
          ORGANIZACAO: org.displayName,
          LOTE: lot.title,
          LANCE: formatBRL(params.amountCents),
          LINK: bidUrl,
        }),
      ]);
      await sendEmail(prev.email, email, { from: sender.from, replyTo: sender.replyTo });
    }
  }

  return {
    currentBidCents: params.amountCents,
    minNextCents: params.amountCents + lot.minIncrementCents,
    endsAt: (ext ?? lot.endsAt).toISOString(),
    bidCount: lot.bidCount + 1,
  };
}
