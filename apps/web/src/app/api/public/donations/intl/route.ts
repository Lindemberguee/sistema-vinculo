import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@donation/db";
import { isAppError } from "@donation/shared";
import { getIntlGateway, isIntlConfigured } from "@donation/payments";
import { resolveTenant } from "@/server/tenant";
import { validateIntlAmount } from "@/server/intl/logic";
import { enforceRoute } from "@/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  campaignSlug: z.string().min(1).max(120),
  currency: z.string().length(3),
  amountMinor: z.number().int().positive(),
  anonymous: z.boolean().default(false),
  message: z.string().max(500).optional(),
  donor: z.object({ name: z.string().min(2).max(120), email: z.string().email() }),
  consent: z.object({ email: z.boolean(), whatsapp: z.boolean() }),
});

export async function POST(req: Request) {
  if (!isIntlConfigured()) return NextResponse.json({ error: "intl_disabled" }, { status: 503 });

  const limited = await enforceRoute(req, "donation");
  if (limited) return limited;

  const host = req.headers.get("x-tenant-host") ?? req.headers.get("host") ?? "";
  const tenant = await resolveTenant(host);
  if (!tenant || tenant.kind !== "site") return NextResponse.json({ error: "unknown_tenant" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 422 });
  }
  const input = parsed.data;

  const amt = validateIntlAmount(input.currency, input.amountMinor);
  if (!amt.ok) return NextResponse.json({ error: "validation_error", message: amt.reason }, { status: 422 });

  try {
    const org = await prisma.organization.findUnique({
      where: { id: tenant.organizationId },
      select: { id: true, displayName: true, status: true },
    });
    if (!org || org.status !== "ACTIVE") return NextResponse.json({ error: "org_not_ready" }, { status: 403 });

    const campaign = await prisma.campaign.findUnique({
      where: { organizationId_slug: { organizationId: org.id, slug: input.campaignSlug } },
      select: { id: true, title: true, status: true },
    });
    if (!campaign || campaign.status !== "PUBLISHED") {
      return NextResponse.json({ error: "campaign_not_open" }, { status: 403 });
    }

    const donor = await prisma.donor.upsert({
      where: { organizationId_email: { organizationId: org.id, email: input.donor.email.toLowerCase() } },
      create: {
        organizationId: org.id,
        email: input.donor.email.toLowerCase(),
        name: input.donor.name,
        consent: { ...input.consent, at: new Date().toISOString(), source: "intl", ip: "n/a" },
      },
      update: { name: input.donor.name },
      select: { id: true },
    });

    const donationId = randomUUID();
    const scheme = tenant.host.includes("localhost") ? "http" : "https";
    const base = `${scheme}://${tenant.host}`;

    const { sessionId, url } = await getIntlGateway().createCheckoutSession({
      donationId,
      organizationId: org.id,
      campaignId: campaign.id,
      currency: amt.currency.toLowerCase(),
      amountMinor: input.amountMinor,
      productName: `Doação — ${campaign.title}`,
      customerEmail: input.donor.email,
      successUrl: `${base}/${input.campaignSlug}?intl=ok`,
      cancelUrl: `${base}/${input.campaignSlug}?intl=cancel`,
    });

    await prisma.donation.create({
      data: {
        id: donationId,
        organizationId: org.id,
        campaignId: campaign.id,
        donorId: donor.id,
        currency: amt.currency,
        amountCents: input.amountMinor,
        tipCents: 0,
        platformFeeCents: 0,
        netToOrgCents: input.amountMinor, // repasse internacional é manual por enquanto
        method: "CREDIT_CARD",
        status: "PENDING",
        anonymous: input.anonymous,
        message: input.message,
        gatewayOrderId: sessionId,
        metadata: { kind: "intl", gateway: "stripe" },
      },
    });

    return NextResponse.json({ url });
  } catch (err) {
    if (isAppError(err)) return NextResponse.json({ error: err.code, message: err.message }, { status: err.httpStatus });
    console.error("intl donation failed", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
