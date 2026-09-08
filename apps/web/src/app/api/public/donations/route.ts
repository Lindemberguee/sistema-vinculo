import { NextResponse } from "next/server";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { resolveTenant } from "@/server/tenant";
import { createDonation } from "@/server/donations/create-donation";
import { enforceRoute } from "@/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  campaignSlug: z.string().min(1).max(120),
  amountCents: z.number().int().positive().max(100_000_00),
  tipCents: z.number().int().nonnegative().max(100_000_00).default(0),
  method: z.enum(["PIX", "CREDIT_CARD", "BOLETO"]),
  recurring: z.boolean().default(false),
  /** Present for an apadrinhamento checkout. */
  sponseeId: z.string().min(1).max(40).optional(),
  /** Present when the donor picked a campaign reward ("cota"). */
  rewardId: z.string().min(1).max(40).optional(),
  /** Present when the visitor arrived through a trackable donation link. */
  donationLinkId: z.string().min(1).max(40).optional(),
  /** Present when the donation is credited to a campaign ambassador's page. */
  ambassadorId: z.string().min(1).max(40).optional(),
  installments: z.number().int().min(1).max(12).optional(),
  cardToken: z.string().min(4).optional(),
  /** Card / boleto billing address (acquirer requires it for card charges). */
  billingAddress: z
    .object({
      line1: z.string().min(3).max(160),
      line2: z.string().max(160).optional(),
      zipCode: z.string().regex(/^\d{8}$/),
      city: z.string().min(2).max(80),
      state: z.string().regex(/^[A-Za-z]{2}$/),
    })
    .optional(),
  anonymous: z.boolean().default(false),
  message: z.string().max(500).optional(),
  dedication: z.object({ to: z.string().min(1).max(120), message: z.string().max(500).optional() }).optional(),
  donor: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    document: z.string().min(11).max(18).optional(),
    phone: z.string().min(10).max(15).optional(),
  }),
  consent: z.object({ email: z.boolean(), whatsapp: z.boolean() }),
  metadata: z.record(z.string()).default({}),
});

export async function POST(req: Request) {
  const limited = await enforceRoute(req, "donation");
  if (limited) return limited;

  const host = req.headers.get("x-tenant-host") ?? req.headers.get("host") ?? "";
  const tenant = await resolveTenant(host);
  if (!tenant || tenant.kind !== "site") {
    return NextResponse.json({ error: "unknown_tenant" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 422 });
  }
  const input = parsed.data;

  if (input.method === "CREDIT_CARD") {
    if (!input.cardToken) {
      return NextResponse.json({ error: "card_token_required" }, { status: 422 });
    }
    if (!input.billingAddress) {
      return NextResponse.json(
        { error: "billing_address_required", message: "Endereço de cobrança é obrigatório para cartão." },
        { status: 422 },
      );
    }
    if (!input.donor.phone || input.donor.phone.replace(/\D/g, "").length < 10) {
      return NextResponse.json(
        { error: "phone_required", message: "Telefone com DDD é obrigatório para pagamento com cartão." },
        { status: 422 },
      );
    }
  }

  try {
    const { donation, recurring, declineReason } = await createDonation({
      organizationId: tenant.organizationId,
      campaignSlug: input.campaignSlug,
      amountCents: input.amountCents,
      tipCents: input.tipCents,
      method: input.method,
      recurring: input.recurring,
      sponseeId: input.sponseeId,
      rewardId: input.rewardId,
      donationLinkId: input.donationLinkId,
      ambassadorId: input.ambassadorId,
      installments: input.installments,
      cardToken: input.cardToken,
      billingAddress: input.billingAddress,
      anonymous: input.anonymous,
      message: input.message,
      dedication: input.dedication,
      donor: input.donor,
      consent: input.consent,
      metadata: input.metadata,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
    });

    return NextResponse.json({
      id: donation.id,
      status: donation.status,
      payment: donation.paymentDetails ?? null,
      recurring,
      // A card subscription has no immediate charge to poll; confirmation is by e-mail.
      subscription: recurring && input.method === "CREDIT_CARD",
      ...(declineReason ? { message: declineReason } : {}),
    });
  } catch (err) {
    if (isAppError(err)) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.httpStatus });
    }
    console.error("createDonation failed", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
