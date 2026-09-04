import { prisma } from "@donation/db";

/**
 * Auto-close raffles whose `drawAt` has passed. The draw itself stays manual
 * (an operator supplies the seed) — this only flips OPEN → CLOSED so sales stop
 * and the "Sortear" action unlocks in the panel.
 */
export async function closeRafflesPastDraw(): Promise<{ closed: number }> {
  const now = new Date();
  const due = await prisma.raffle.findMany({
    where: { status: "OPEN", drawAt: { not: null, lte: now } },
    take: 200,
    select: { id: true, organizationId: true },
  });

  for (const r of due) {
    await prisma.raffle.update({ where: { id: r.id }, data: { status: "CLOSED" } });
    await prisma.auditLog.create({
      data: {
        organizationId: r.organizationId,
        action: "raffle.autoclosed",
        entity: "Raffle",
        entityId: r.id,
        diff: { at: now.toISOString() },
      },
    });
  }

  return { closed: due.length };
}
