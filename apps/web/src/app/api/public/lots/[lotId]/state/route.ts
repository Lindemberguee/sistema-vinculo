import { NextResponse } from "next/server";
import { prisma } from "@donation/db";
import { resolveTenant } from "@/server/tenant";
import { minNextBidCents } from "@/server/auction/logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ lotId: string }> }) {
  const { lotId } = await ctx.params;
  const host = req.headers.get("x-tenant-host") ?? req.headers.get("host") ?? "";
  const tenant = await resolveTenant(host);
  if (!tenant || tenant.kind !== "site") return NextResponse.json({ error: "unknown_tenant" }, { status: 404 });

  const lot = await prisma.lot.findFirst({
    where: { id: lotId, organizationId: tenant.organizationId },
    select: {
      status: true,
      startPriceCents: true,
      minIncrementCents: true,
      currentBidCents: true,
      bidCount: true,
      endsAt: true,
    },
  });
  if (!lot) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    status: lot.status,
    currentBidCents: lot.currentBidCents,
    minNextCents: minNextBidCents(lot.currentBidCents, lot.startPriceCents, lot.minIncrementCents),
    bidCount: lot.bidCount,
    endsAt: lot.endsAt.toISOString(),
  });
}
