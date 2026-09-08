import { NextResponse } from "next/server";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { resolveTenant } from "@/server/tenant";
import { createEventOrder } from "@/server/events/order";
import { enforceRoute } from "@/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  items: z.array(z.object({ ticketTypeId: z.string().min(1), quantity: z.number().int().min(0).max(20) })).min(1),
  attendees: z.array(z.string().max(120)).max(40).optional(),
  method: z.enum(["PIX", "CREDIT_CARD", "BOLETO"]),
  cardToken: z.string().min(4).optional(),
  installments: z.number().int().min(1).max(12).optional(),
  billingAddress: z
    .object({
      line1: z.string().min(3).max(160),
      line2: z.string().max(160).optional(),
      zipCode: z.string().regex(/^\d{8}$/),
      city: z.string().min(2).max(80),
      state: z.string().regex(/^[A-Za-z]{2}$/),
    })
    .optional(),
  tipCents: z.number().int().nonnegative().max(100_000_00).default(0),
  donor: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    document: z.string().min(11).max(18).optional(),
    phone: z.string().min(10).max(15).optional(),
  }),
  consent: z.object({ email: z.boolean(), whatsapp: z.boolean() }),
  metadata: z.record(z.string()).default({}),
});

export async function POST(req: Request, ctx: { params: Promise<{ eventId: string }> }) {
  const limited = await enforceRoute(req, "donation");
  if (limited) return limited;

  const { eventId } = await ctx.params;
  const host = req.headers.get("x-tenant-host") ?? req.headers.get("host") ?? "";
  const tenant = await resolveTenant(host);
  if (!tenant || tenant.kind !== "site") return NextResponse.json({ error: "unknown_tenant" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 422 });
  }
  const input = parsed.data;
  if (input.method === "CREDIT_CARD") {
    if (!input.cardToken) return NextResponse.json({ error: "card_token_required" }, { status: 422 });
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
    const { donation, ticketCodes } = await createEventOrder({
      organizationId: tenant.organizationId,
      eventId,
      items: input.items,
      attendees: input.attendees,
      method: input.method,
      cardToken: input.cardToken,
      installments: input.installments,
      billingAddress: input.billingAddress,
      tipCents: input.tipCents,
      donor: input.donor,
      consent: input.consent,
      metadata: input.metadata,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
    });
    return NextResponse.json({
      id: donation.id,
      status: donation.status,
      ticketCodes,
      payment: donation.paymentDetails ?? null,
    });
  } catch (err) {
    if (isAppError(err)) return NextResponse.json({ error: err.code, message: err.message }, { status: err.httpStatus });
    console.error("createEventOrder failed", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
