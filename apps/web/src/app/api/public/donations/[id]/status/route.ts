import { NextResponse } from "next/server";
import { prisma } from "@donation/db";
import { resolveTenant } from "@/server/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Front-end polls this after starting a Pix/boleto payment. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const host = _req.headers.get("x-tenant-host") ?? _req.headers.get("host") ?? "";
  const tenant = await resolveTenant(host);
  if (!tenant || tenant.kind !== "site") {
    return NextResponse.json({ error: "unknown_tenant" }, { status: 404 });
  }

  const donation = await prisma.donation.findFirst({
    where: { id, organizationId: tenant.organizationId },
    select: { id: true, status: true, paidAt: true },
  });
  if (!donation) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ id: donation.id, status: donation.status, paidAt: donation.paidAt });
}
