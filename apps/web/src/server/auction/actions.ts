"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";
import { assertModule } from "@/server/billing/limits";

export interface AuctionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

const reaisToCents = (s: string) => Math.round(Number(s.trim().replace(/\./g, "").replace(",", ".")) * 100);

const auctionSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().min(5).max(6000),
  antiSnipeSeconds: z.coerce.number().int().min(0).max(3600).default(120),
  campaignId: z.string().optional().or(z.literal("")),
});

export async function createAuction(orgId: string, formData: FormData): Promise<AuctionResult> {
  let id: string;
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    await assertModule(orgId, "auctions");
    const parsed = auctionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    const d = parsed.data;
    const row = await db.auction.create({
      data: {
        organizationId: orgId,
        status: "DRAFT",
        title: d.title,
        description: d.description,
        antiSnipeSeconds: d.antiSnipeSeconds,
        campaignId: d.campaignId || null,
      },
      select: { id: true },
    });
    id = row.id;
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${orgId}/auctions`);
  redirect(`/orgs/${orgId}/auctions/${id}`);
}

export async function updateAuction(orgId: string, auctionId: string, formData: FormData): Promise<AuctionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = auctionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    const existing = await db.auction.findFirst({ where: { id: auctionId }, select: { id: true } });
    if (!existing) return { ok: false, error: "Leilão não encontrado" };
    const d = parsed.data;
    await db.auction.update({
      where: { id: auctionId },
      data: { title: d.title, description: d.description, antiSnipeSeconds: d.antiSnipeSeconds, campaignId: d.campaignId || null },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${orgId}/auctions/${auctionId}`);
  return { ok: true };
}

const STATUS_OK: Record<string, string[]> = {
  DRAFT: ["OPEN", "CANCELED"],
  OPEN: ["ENDED", "CANCELED"],
  ENDED: ["SETTLED", "OPEN"],
};

export async function setAuctionStatus(
  orgId: string,
  auctionId: string,
  next: "OPEN" | "ENDED" | "SETTLED" | "CANCELED",
): Promise<AuctionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const a = await db.auction.findFirst({ where: { id: auctionId }, select: { status: true, _count: { select: { lots: true } } } });
    if (!a) return { ok: false, error: "Leilão não encontrado" };
    if (next === "OPEN" && a._count.lots === 0) return { ok: false, error: "Adicione ao menos um lote antes de abrir" };
    if (!STATUS_OK[a.status]?.includes(next)) return { ok: false, error: `Transição inválida: ${a.status} → ${next}` };
    await db.auction.update({ where: { id: auctionId }, data: { status: next } });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${orgId}/auctions/${auctionId}`);
  return { ok: true };
}

const lotSchema = z.object({
  title: z.string().min(2).max(140),
  description: z.string().min(2).max(4000),
  photoUrl: z.string().url().optional().or(z.literal("")),
  startPriceReais: z.string(),
  minIncrementReais: z.string(),
  endsAt: z.string().min(10),
});

function lotData(d: z.infer<typeof lotSchema>) {
  const start = reaisToCents(d.startPriceReais);
  const inc = reaisToCents(d.minIncrementReais);
  return {
    title: d.title,
    description: d.description,
    photoUrl: d.photoUrl || null,
    startPriceCents: Number.isFinite(start) && start >= 0 ? start : 0,
    minIncrementCents: Number.isFinite(inc) && inc >= 100 ? inc : 100,
    endsAt: new Date(d.endsAt),
  };
}

export async function addLot(orgId: string, auctionId: string, formData: FormData): Promise<AuctionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = lotSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    const a = await db.auction.findFirst({ where: { id: auctionId }, select: { id: true } });
    if (!a) return { ok: false, error: "Leilão não encontrado" };
    await db.lot.create({ data: { auctionId, organizationId: orgId, ...lotData(parsed.data) } });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${orgId}/auctions/${auctionId}`);
  return { ok: true };
}

export async function updateLot(orgId: string, lotId: string, formData: FormData): Promise<AuctionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = lotSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    const lot = await db.lot.findFirst({ where: { id: lotId }, select: { bidCount: true, auctionId: true } });
    if (!lot) return { ok: false, error: "Lote não encontrado" };
    const data = lotData(parsed.data);
    if (lot.bidCount > 0) {
      // Once bidding started, only description/photo/end time may change.
      await db.lot.update({ where: { id: lotId }, data: { description: data.description, photoUrl: data.photoUrl, endsAt: data.endsAt } });
    } else {
      await db.lot.update({ where: { id: lotId }, data });
    }
    revalidatePath(`/panel/orgs/${orgId}/auctions/${lot.auctionId}`);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  return { ok: true };
}

export async function removeLot(orgId: string, lotId: string): Promise<AuctionResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const lot = await db.lot.findFirst({ where: { id: lotId }, select: { bidCount: true, auctionId: true } });
    if (!lot) return { ok: false, error: "Lote não encontrado" };
    if (lot.bidCount > 0) return { ok: false, error: "Já há lances neste lote." };
    await db.lot.deleteMany({ where: { id: lotId } });
    revalidatePath(`/panel/orgs/${orgId}/auctions/${lot.auctionId}`);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  return { ok: true };
}

export async function createAuctionFormAction(orgId: string, _p: AuctionResult | null, fd: FormData) {
  return createAuction(orgId, fd);
}
export async function updateAuctionFormAction(orgId: string, auctionId: string, _p: AuctionResult | null, fd: FormData) {
  return updateAuction(orgId, auctionId, fd);
}
