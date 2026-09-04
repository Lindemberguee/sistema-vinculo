import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RFC-4180-ish CSV cell escaping (matches the worker's export processor). */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = value instanceof Date ? value.toLocaleString("pt-BR") : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const line = (cells: unknown[]) => cells.map(cell).join(",");

const STATUS_LABEL: Record<string, string> = {
  RESERVED: "Reservado (não pago)",
  VALID: "Válido",
  USED: "Utilizado (check-in)",
  REFUNDED: "Estornado",
};

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string; eventId: string }> }) {
  const { orgId, eventId } = await params;

  let db;
  try {
    ({ db } = await requireOrgAccess(orgId, "EDITOR"));
  } catch (err) {
    if (isAppError(err)) return new Response(err.message, { status: err.httpStatus });
    return new Response("Unauthorized", { status: 401 });
  }

  const event = await db.event.findFirst({ where: { id: eventId }, select: { title: true } });
  if (!event) return new Response("Evento não encontrado", { status: 404 });

  const tickets = await db.eventTicket.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: {
      code: true,
      status: true,
      attendeeName: true,
      checkedInAt: true,
      createdAt: true,
      ticketType: { select: { name: true } },
      donation: { select: { status: true, donor: { select: { name: true, email: true } } } },
    },
  });

  const header = [
    "Nome do comprador",
    "E-mail",
    "Tipo de ingresso",
    "Nome no ingresso",
    "Status",
    "Check-in em",
    "Pagamento",
    "Código",
    "Comprado em",
  ];
  const body = tickets.map((t) =>
    line([
      t.donation?.donor?.name ?? "",
      t.donation?.donor?.email ?? "",
      t.ticketType.name,
      t.attendeeName ?? "",
      STATUS_LABEL[t.status] ?? t.status,
      t.checkedInAt ?? "",
      t.donation?.status ?? "",
      t.code,
      t.createdAt,
    ]),
  );

  const csv = "﻿" + [line(header), ...body].join("\r\n") + "\r\n";
  const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "evento";

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="participantes-${slug}.csv"`,
      "cache-control": "no-store",
    },
  });
}
