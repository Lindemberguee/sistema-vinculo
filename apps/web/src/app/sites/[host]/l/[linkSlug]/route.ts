import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@donation/db";
import { resolveTenant } from "@/server/tenant";
import { isLinkSlug } from "@/server/links/slug";
import { linkIsLive } from "@/server/links/presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public entry point for a trackable donation link: `https://{host}/l/{slug}`.
 * Counts a (cookie-deduped) visit and forwards to the campaign page with a
 * `?ref=` marker the page uses to pre-fill the checkout.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ host: string; linkSlug: string }> }) {
  const { host: hostParam, linkSlug } = await params;
  const host = decodeURIComponent(hostParam);
  const origin = `${req.nextUrl.protocol}//${host}`;
  const home = NextResponse.redirect(new URL("/", origin));

  const tenant = await resolveTenant(host);
  if (!tenant || tenant.kind !== "site") return home;

  const slug = linkSlug.toLowerCase();
  if (!isLinkSlug(slug)) return home;

  const link = await prisma.donationLink.findFirst({
    where: { slug, organizationId: tenant.organizationId },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      visits: true,
      campaign: { select: { slug: true, status: true } },
    },
  });
  if (!link) return home;

  const campaignUrl = new URL(`/${link.campaign.slug}`, origin);
  if (link.campaign.status !== "PUBLISHED") return NextResponse.redirect(campaignUrl);

  // A paused / expired link still works as a plain campaign link — just untracked.
  if (!linkIsLive(link)) return NextResponse.redirect(campaignUrl);

  campaignUrl.searchParams.set("ref", slug);
  const res = NextResponse.redirect(campaignUrl);

  // One visit per browser per 12h keeps the counter meaningful against reloads.
  const seenCookie = `dl_${slug}`;
  if (!req.cookies.get(seenCookie)) {
    try {
      await prisma.donationLink.update({ where: { id: link.id }, data: { visits: { increment: 1 } } });
    } catch {
      /* a missed visit count is not worth failing the redirect */
    }
    res.cookies.set(seenCookie, "1", {
      maxAge: 60 * 60 * 12,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  return res;
}
