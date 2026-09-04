import { NextResponse } from "next/server";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { resolveTenant } from "@/server/tenant";
import { placeBid } from "@/server/auction/bid";
import { enforceRoute } from "@/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  amountCents: z.number().int().positive().max(100_000_000),
  donor: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    document: z.string().min(11).max(18).optional(),
    phone: z.string().min(10).max(15).optional(),
  }),
  consent: z.object({ email: z.boolean(), whatsapp: z.boolean() }),
});

export async function POST(req: Request, ctx: { params: Promise<{ lotId: string }> }) {
  const limited = await enforceRoute(req, "donation");
  if (limited) return limited;

  const { lotId } = await ctx.params;
  const host = req.headers.get("x-tenant-host") ?? req.headers.get("host") ?? "";
  const tenant = await resolveTenant(host);
  if (!tenant || tenant.kind !== "site") return NextResponse.json({ error: "unknown_tenant" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const state = await placeBid({
      organizationId: tenant.organizationId,
      lotId,
      amountCents: parsed.data.amountCents,
      donor: parsed.data.donor,
      consent: parsed.data.consent,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
    });
    return NextResponse.json(state);
  } catch (err) {
    if (isAppError(err)) return NextResponse.json({ error: err.code, message: err.message }, { status: err.httpStatus });
    console.error("placeBid failed", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
