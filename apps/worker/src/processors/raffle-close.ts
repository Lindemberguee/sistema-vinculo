import { randomBytes } from "node:crypto";
import { prisma } from "@donation/db";

/**
 * Auto-close raffles whose `drawAt` has passed. The draw itself stays manual
 * — this commits server-side entropy and flips OPEN → CLOSED so sales stop.
 */
export async function closeRafflesPastDraw(): Promise<{ closed: number }> {
  const now = new Date();
  const due = await prisma.raffle.findMany({
    where: { status: "OPEN", drawAt: { not: null, lte: now } },
    take: 200,
    select: { id: true, organizationId: true },
  });

  for (const r of due) {
    await prisma.raffle.update({ where: { id: r.id }, data: { status: "CLOSED", drawSeed: randomBytes(32).toString("hex") } });
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
