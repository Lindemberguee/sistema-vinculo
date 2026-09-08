"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { renderOrgEmail, resolveOrgSender } from "@donation/db";
import { sendEmail } from "@donation/emails";
import { requireOrgAccess } from "@/server/auth-helpers";
import { assertModule } from "@/server/billing/limits";
import { orgPublicOrigin } from "@/server/links/url";
import { drawWinnerIndex } from "@/server/raffle/logic";
import { enqueueRaffleResult } from "@/server/queue";

export interface RaffleResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

const reaisToCents = (s: string) => Math.round(Number(s.trim().replace(/\./g, "").replace(",", ".")) * 100);

const raffleSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(5).max(4000),
  prize: z.string().min(2).max(300),
  priceReais: z.string(),
  totalNumbers: z.coerce.number().int().min(10).max(1_000_000),
  minPerPurchase: z.coerce.number().int().min(1).max(1000).default(1),
  maxPerPurchase: z.coerce.number().int().min(1).max(1000).default(50),
  drawAt: z.string().optional(),
  campaignId: z.string().optional().or(z.literal("")),
});

function toData(d: z.infer<typeof raffleSchema>) {
  const price = reaisToCents(d.priceReais);
  return {
    title: d.title,
    description: d.description,
    prize: d.prize,
    ticketPriceCents: Number.isFinite(price) && price >= 100 ? price : 500,
    totalNumbers: d.totalNumbers,
    minPerPurchase: Math.min(d.minPerPurchase, d.maxPerPurchase),
    maxPerPurchase: Math.max(d.minPerPurchase, d.maxPerPurchase),
    drawAt: d.drawAt ? new Date(d.drawAt) : null,
    campaignId: d.campaignId || null,
  };
}

export async function createRaffle(orgId: string, formData: FormData): Promise<RaffleResult> {
  let id: string;
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    await assertModule(orgId, "raffles");
    const parsed = raffleSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    const row = await db.raffle.create({ data: { organizationId: orgId, status: "DRAFT", ...toData(parsed.data) }, select: { id: true } });
    id = row.id;
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${orgId}/raffles`);
  redirect(`/orgs/${orgId}/raffles/${id}`);
}

export async function updateRaffle(orgId: string, raffleId: string, formData: FormData): Promise<RaffleResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = raffleSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    const r = await db.raffle.findFirst({ where: { id: raffleId }, select: { status: true } });
    if (!r) return { ok: false, error: "Rifa não encontrada" };
    if (r.status === "DRAWN") return { ok: false, error: "Rifa já foi sorteada" };

    const data = toData(parsed.data);
    // Once tickets are sold, totalNumbers can only grow.
    if (r.status !== "DRAFT") {
      const highest = await db.raffleTicket.findFirst({
        where: { raffleId },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      if (highest && data.totalNumbers < highest.number) {
        return { ok: false, error: `Já há números vendidos até ${highest.number}; não é possível reduzir.` };
      }
    }
    await db.raffle.update({ where: { id: raffleId }, data });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${orgId}/raffles/${raffleId}`);
  return { ok: true };
}

const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["OPEN", "CANCELED"],
  OPEN: ["CLOSED", "CANCELED"],
  // Closing commits the draw entropy; reopening would let an operator change
  // the eligible ticket set after seeing the committed seed.
  CLOSED: ["CANCELED"],
};

export async function setRaffleStatus(
  orgId: string,
  raffleId: string,
  next: "OPEN" | "CLOSED" | "CANCELED",
): Promise<RaffleResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const r = await db.raffle.findFirst({ where: { id: raffleId }, select: { status: true } });
    if (!r) return { ok: false, error: "Rifa não encontrada" };
    if (!TRANSITIONS[r.status]?.includes(next)) {
      return { ok: false, error: `Transição inválida: ${r.status} → ${next}` };
    }
    await db.raffle.update({
      where: { id: raffleId },
      // Commit entropy when sales close. The operator cannot choose a seed
      // after seeing the final paid ticket set.
      data: { status: next, ...(next === "CLOSED" ? { drawSeed: randomBytes(32).toString("hex") } : {}) },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${orgId}/raffles/${raffleId}`);
  return { ok: true };
}

/** Draw a winner among PAID tickets using entropy committed when sales closed. */
export async function drawRaffle(orgId: string, raffleId: string, _seedInput: string): Promise<RaffleResult> {
  try {
    const { db, userId } = await requireOrgAccess(orgId, "EDITOR");

    const raffle = await db.raffle.findFirst({
      where: { id: raffleId },
      select: { status: true, drawSeed: true, title: true, prize: true, organization: { select: { displayName: true, slug: true } } },
    });
    if (!raffle) return { ok: false, error: "Rifa não encontrada" };
    if (raffle.status !== "CLOSED") return { ok: false, error: "Feche a rifa antes de sortear" };
    const seed = raffle.drawSeed ?? randomBytes(32).toString("hex");

    const paid = await db.raffleTicket.findMany({
      where: { raffleId, status: "PAID" },
      orderBy: { number: "asc" },
      select: { id: true, number: true, donorId: true },
    });
    if (paid.length === 0) return { ok: false, error: "Nenhum número pago — não há como sortear" };

    const idx = drawWinnerIndex(seed, paid.length);
    const winner = paid[idx]!;

    const claimed = await db.raffle.updateMany({
      where: { id: raffleId, status: "CLOSED" },
      data: {
        status: "DRAWN",
        drawSeed: seed,
        drawnNumber: winner.number,
        winnerTicketId: winner.id,
        drawnAt: new Date(),
      },
    });
    if (claimed.count !== 1) return { ok: false, error: "A rifa já foi sorteada por outro operador." };
    await db.auditLog.create({
      data: {
        organizationId: orgId,
        userId,
        action: "raffle.drawn",
        entity: "Raffle",
        entityId: raffleId,
        diff: { seed, number: winner.number, paidCount: paid.length, idx },
      },
    });

    const resultUrl = `${orgPublicOrigin({ slug: raffle.organization.slug })}/rifa/${raffleId}`;

    if (winner.donorId) {
      const donor = await db.donor.findFirst({ where: { id: winner.donorId }, select: { name: true, email: true } });
      if (donor) {
        const [sender, email] = await Promise.all([
          resolveOrgSender(orgId),
          renderOrgEmail(orgId, "RAFFLE_WINNER", {
            NOME: donor.name.trim().split(/\s+/)[0] || donor.name,
            ORGANIZACAO: raffle.organization.displayName,
            CAMPANHA: raffle.title,
            PREMIO: raffle.prize,
            NUMERO: String(winner.number),
            LINK: resultUrl,
          }),
        ]);
        await sendEmail(donor.email, email, { from: sender.from, replyTo: sender.replyTo });
      }
    }

    // Fan-out: let every paid participant check their numbers against the seed.
    try {
      await enqueueRaffleResult(raffleId);
    } catch (e) {
      console.error("enqueueRaffleResult failed:", e);
    }
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${orgId}/raffles/${raffleId}`);
  return { ok: true };
}

// useActionState adapters
export async function createRaffleFormAction(orgId: string, _p: RaffleResult | null, fd: FormData) {
  return createRaffle(orgId, fd);
}
export async function updateRaffleFormAction(orgId: string, raffleId: string, _p: RaffleResult | null, fd: FormData) {
  return updateRaffle(orgId, raffleId, fd);
}
