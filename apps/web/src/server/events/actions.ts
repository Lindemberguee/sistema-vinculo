"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";
import { assertModule } from "@/server/billing/limits";

export interface EventResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

const reaisToCents = (s: string) => Math.round(Number(s.trim().replace(/\./g, "").replace(",", ".")) * 100);

const eventSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().min(5).max(6000),
  venue: z.string().min(2).max(200),
  address: z.string().max(300).optional().or(z.literal("")),
  startsAt: z.string().min(10),
  endsAt: z.string().optional().or(z.literal("")),
  campaignId: z.string().optional().or(z.literal("")),
});

function toData(d: z.infer<typeof eventSchema>) {
  return {
    title: d.title,
    description: d.description,
    venue: d.venue,
    address: d.address || null,
    startsAt: new Date(d.startsAt),
    endsAt: d.endsAt ? new Date(d.endsAt) : null,
    campaignId: d.campaignId || null,
  };
}

export async function createEvent(orgId: string, formData: FormData): Promise<EventResult> {
  let id: string;
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    await assertModule(orgId, "events");
    const parsed = eventSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    const row = await db.event.create({ data: { organizationId: orgId, status: "DRAFT", ...toData(parsed.data) }, select: { id: true } });
    id = row.id;
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${orgId}/events`);
  redirect(`/orgs/${orgId}/events/${id}`);
}

export async function updateEvent(orgId: string, eventId: string, formData: FormData): Promise<EventResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = eventSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    const existing = await db.event.findFirst({ where: { id: eventId }, select: { id: true } });
    if (!existing) return { ok: false, error: "Evento não encontrado" };
    await db.event.update({ where: { id: eventId }, data: toData(parsed.data) });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${orgId}/events/${eventId}`);
  return { ok: true };
}

const STATUS_OK: Record<string, string[]> = {
  DRAFT: ["PUBLISHED", "CANCELED"],
  PUBLISHED: ["ENDED", "CANCELED"],
  ENDED: ["PUBLISHED"],
};

export async function setEventStatus(
  orgId: string,
  eventId: string,
  next: "PUBLISHED" | "ENDED" | "CANCELED",
): Promise<EventResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const ev = await db.event.findFirst({ where: { id: eventId }, select: { status: true, _count: { select: { ticketTypes: true } } } });
    if (!ev) return { ok: false, error: "Evento não encontrado" };
    if (next === "PUBLISHED" && ev._count.ticketTypes === 0) {
      return { ok: false, error: "Adicione ao menos um tipo de ingresso antes de publicar" };
    }
    if (!STATUS_OK[ev.status]?.includes(next)) return { ok: false, error: `Transição inválida: ${ev.status} → ${next}` };
    await db.event.update({ where: { id: eventId }, data: { status: next } });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${orgId}/events/${eventId}`);
  return { ok: true };
}

const typeSchema = z.object({
  name: z.string().min(1).max(80),
  priceReais: z.string(),
  quantity: z.coerce.number().int().min(1).max(100_000),
  maxPerOrder: z.coerce.number().int().min(1).max(100).default(6),
});

export async function addTicketType(orgId: string, eventId: string, formData: FormData): Promise<EventResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = typeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    const ev = await db.event.findFirst({ where: { id: eventId }, select: { id: true } });
    if (!ev) return { ok: false, error: "Evento não encontrado" };
    const price = reaisToCents(parsed.data.priceReais);
    await db.eventTicketType.create({
      data: {
        eventId,
        organizationId: orgId,
        name: parsed.data.name,
        priceCents: Number.isFinite(price) && price >= 0 ? price : 0,
        quantity: parsed.data.quantity,
        maxPerOrder: parsed.data.maxPerOrder,
      },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${orgId}/events/${eventId}`);
  return { ok: true };
}

export async function updateTicketType(orgId: string, typeId: string, formData: FormData): Promise<EventResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = typeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    const tt = await db.eventTicketType.findFirst({ where: { id: typeId }, select: { sold: true, eventId: true } });
    if (!tt) return { ok: false, error: "Tipo não encontrado" };
    if (parsed.data.quantity < tt.sold) return { ok: false, error: `Já foram vendidos ${tt.sold}; não é possível reduzir abaixo disso.` };
    const price = reaisToCents(parsed.data.priceReais);
    await db.eventTicketType.update({
      where: { id: typeId },
      data: {
        name: parsed.data.name,
        priceCents: Number.isFinite(price) && price >= 0 ? price : 0,
        quantity: parsed.data.quantity,
        maxPerOrder: parsed.data.maxPerOrder,
      },
    });
    revalidatePath(`/panel/orgs/${orgId}/events/${tt.eventId}`);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  return { ok: true };
}

export async function removeTicketType(orgId: string, typeId: string): Promise<EventResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const tt = await db.eventTicketType.findFirst({ where: { id: typeId }, select: { sold: true, eventId: true } });
    if (!tt) return { ok: false, error: "Tipo não encontrado" };
    if (tt.sold > 0) return { ok: false, error: "Já há ingressos vendidos deste tipo." };
    await db.eventTicketType.deleteMany({ where: { id: typeId } });
    revalidatePath(`/panel/orgs/${orgId}/events/${tt.eventId}`);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  return { ok: true };
}

export interface CheckInResult {
  ok: boolean;
  error?: string;
  attendee?: string | null;
  typeName?: string;
  alreadyUsedAt?: string;
}

/** Validate a ticket code at the door. */
export async function checkInTicket(orgId: string, eventId: string, rawCode: string): Promise<CheckInResult> {
  try {
    const { db, userId } = await requireOrgAccess(orgId, "EDITOR");
    const code = rawCode.trim();
    if (!code) return { ok: false, error: "Código vazio" };

    // Atomic claim: only a VALID ticket flips to USED, and only once — two
    // simultaneous scans of the same code can't both succeed.
    const claim = await db.eventTicket.updateMany({
      where: { code, eventId, status: "VALID" },
      data: { status: "USED", checkedInAt: new Date(), checkedInBy: userId },
    });

    const ticket = await db.eventTicket.findFirst({
      where: { code, eventId },
      select: { status: true, attendeeName: true, checkedInAt: true, ticketType: { select: { name: true } } },
    });
    if (!ticket) return { ok: false, error: "Ingresso não encontrado para este evento" };

    if (claim.count === 1) {
      return { ok: true, attendee: ticket.attendeeName, typeName: ticket.ticketType.name };
    }
    if (ticket.status === "USED") {
      return {
        ok: false,
        error: "Ingresso já utilizado",
        alreadyUsedAt: ticket.checkedInAt?.toLocaleString("pt-BR"),
        attendee: ticket.attendeeName,
        typeName: ticket.ticketType.name,
      };
    }
    return { ok: false, error: "Ingresso inválido (pagamento não confirmado ou estornado)" };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}

// useActionState adapters
export async function createEventFormAction(orgId: string, _p: EventResult | null, fd: FormData) {
  return createEvent(orgId, fd);
}
export async function updateEventFormAction(orgId: string, eventId: string, _p: EventResult | null, fd: FormData) {
  return updateEvent(orgId, eventId, fd);
}
