export interface OrderItem {
  ticketTypeId: string;
  quantity: number;
}

export interface TypeInfo {
  priceCents: number;
  available: number;
  maxPerOrder: number;
}

/** Total in cents for an order given the price of each ticket type. */
export function computeOrderCents(items: OrderItem[], types: Record<string, TypeInfo>): number {
  let total = 0;
  for (const it of items) {
    const t = types[it.ticketTypeId];
    if (!t) throw new Error(`unknown ticket type: ${it.ticketTypeId}`);
    total += t.priceCents * it.quantity;
  }
  return total;
}

/** Validate quantities against availability and per-order limits. */
export function validateOrderItems(
  items: OrderItem[],
  types: Record<string, TypeInfo>,
): { ok: true; totalTickets: number } | { ok: false; reason: string } {
  const nonZero = items.filter((i) => i.quantity > 0);
  if (nonZero.length === 0) return { ok: false, reason: "Selecione ao menos um ingresso" };

  const seen = new Set<string>();
  let totalTickets = 0;
  for (const it of nonZero) {
    if (seen.has(it.ticketTypeId)) return { ok: false, reason: "Tipo de ingresso repetido" };
    seen.add(it.ticketTypeId);

    const t = types[it.ticketTypeId];
    if (!t) return { ok: false, reason: "Tipo de ingresso inválido" };
    if (!Number.isInteger(it.quantity) || it.quantity < 1) return { ok: false, reason: "Quantidade inválida" };
    if (it.quantity > t.maxPerOrder) return { ok: false, reason: `Máximo ${t.maxPerOrder} por pedido` };
    if (it.quantity > t.available) return { ok: false, reason: "Ingressos esgotados para esse tipo" };
    totalTickets += it.quantity;
  }
  return { ok: true, totalTickets };
}
