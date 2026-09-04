import { NextResponse } from "next/server";
import { prisma } from "@donation/db";
import { resolveTenant } from "@/server/tenant";
import { isLinkSlug } from "@/server/links/slug";
import { linkIsLive, linkToPreset } from "@/server/links/presets";
import { enforceRoute } from "@/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resolves a trackable donation link for the checkout on a (statically cached)
 * campaign page. Returns only what the checkout needs to pre-fill itself.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const limited = await enforceRoute(req, "publicLookup");
  if (limited) return limited;

  const { slug: raw } = await params;
  const slug = raw.toLowerCase();
  if (!isLinkSlug(slug)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const host = req.headers.get("x-tenant-host") ?? req.headers.get("host") ?? "";
  const tenant = await resolveTenant(host);
  if (!tenant || tenant.kind !== "site") return NextResponse.json({ error: "unknown_tenant" }, { status: 404 });

  const link = await prisma.donationLink.findFirst({
    where: { slug, organizationId: tenant.organizationId },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      amountCents: true,
      suggestedAmountsCents: true,
      lockAmount: true,
      defaultRecurring: true,
      defaultCoverFee: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      utmContent: true,
      utmTerm: true,
      campaign: { select: { status: true, minAmountCents: true, suggestedAmountsCents: true } },
    },
  });
  if (!link || link.campaign.status !== "PUBLISHED" || !linkIsLive(link)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const preset = linkToPreset(link, {
    minAmountCents: link.campaign.minAmountCents,
    suggestedAmountsCents: link.campaign.suggestedAmountsCents,
  });

  return NextResponse.json(
    { id: link.id, ...preset },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
