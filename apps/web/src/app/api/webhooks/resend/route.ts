import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@donation/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verify a Svix-signed webhook (Resend uses Svix). Returns true when valid or unconfigured. */
function verify(raw: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true; // dev / not configured — accept but the caller logs a warning

  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !ts || !sigHeader) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${raw}`).digest("base64");

  return sigHeader.split(" ").some((part) => {
    const sig = part.split(",")[1];
    if (!sig) return false;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export async function POST(req: Request) {
  const raw = await req.text();

  if (!verify(raw, req.headers)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  if (!process.env.RESEND_WEBHOOK_SECRET) {
    console.warn("resend webhook: RESEND_WEBHOOK_SECRET not set — accepting unverified");
  }

  let event: { type?: string; data?: { to?: string[] | string; email?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const status =
    event.type === "email.bounced"
      ? "BOUNCED"
      : event.type === "email.complained"
        ? "COMPLAINED"
        : null;
  if (!status) return NextResponse.json({ ok: true, ignored: event.type });

  const to = event.data?.to ?? event.data?.email;
  const emails = (Array.isArray(to) ? to : to ? [to] : []).map((e) => e.toLowerCase());
  if (emails.length === 0) return NextResponse.json({ ok: true, noRecipient: true });

  // A bounce/complaint on an address applies to every org that has that donor.
  const donors = await prisma.donor.findMany({
    where: { email: { in: emails, mode: "insensitive" } },
    select: { organizationId: true, email: true, id: true },
  });

  for (const d of donors) {
    await prisma.donorEmailStatus.upsert({
      where: { organizationId_email: { organizationId: d.organizationId, email: d.email } },
      create: { organizationId: d.organizationId, email: d.email, status, reason: event.type },
      update: { status, reason: event.type, at: new Date() },
    });
    if (status === "COMPLAINED") {
      const donor = await prisma.donor.findUnique({ where: { id: d.id }, select: { consent: true } });
      await prisma.donor.update({
        where: { id: d.id },
        data: { consent: { ...((donor?.consent ?? {}) as object), email: false } },
      });
    }
  }

  return NextResponse.json({ ok: true, applied: donors.length });
}
