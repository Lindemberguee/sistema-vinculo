import QRCode from "qrcode";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";
import { donationLinkUrl, orgPublicOrigin } from "@/server/links/url";
import { enforceRoute } from "@/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PNG QR code for a donation link — panel only, scoped to the caller's org. */
export async function GET(req: Request, { params }: { params: Promise<{ orgId: string; linkId: string }> }) {
  const { orgId, linkId } = await params;

  const limited = await enforceRoute(req, "publicLookup", orgId);
  if (limited) return limited;

  try {
    const { db } = await requireOrgAccess(orgId, "VIEWER");

    const link = await db.donationLink.findFirst({ where: { id: linkId }, select: { slug: true } });
    if (!link) return new Response("not found", { status: 404 });

    const org = await db.organization.findFirst({
      where: { id: orgId },
      select: {
        slug: true,
        customDomains: { where: { verifiedAt: { not: null } }, take: 1, select: { host: true } },
      },
    });
    if (!org) return new Response("not found", { status: 404 });

    const url = donationLinkUrl(
      orgPublicOrigin({ slug: org.slug, customHost: org.customDomains[0]?.host ?? null }),
      link.slug,
    );
    const png = await QRCode.toBuffer(url, { width: 512, margin: 1, errorCorrectionLevel: "M" });

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="qr-${link.slug}.png"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    if (isAppError(err)) return new Response(err.message, { status: err.httpStatus });
    console.error("link QR failed", err);
    return new Response("internal", { status: 500 });
  }
}
