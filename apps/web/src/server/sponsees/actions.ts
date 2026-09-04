"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { sendEmail, sponseeUpdateEmail } from "@donation/emails";
import { prisma } from "@donation/db";
import { requireOrgAccess } from "@/server/auth-helpers";
import { assertModule } from "@/server/billing/limits";

export interface SponseeResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

const reaisToCents = (s: string) => Math.round(Number(s.trim().replace(/\./g, "").replace(",", ".")) * 100);

const sponseeSchema = z.object({
  name: z.string().min(2).max(120),
  category: z.string().min(2).max(40),
  story: z.string().min(10).max(4000),
  photoUrl: z.string().url().optional().or(z.literal("")),
  birthYear: z.string().optional(),
  monthlyReais: z.string(),
  campaignId: z.string().optional().or(z.literal("")),
});

function toData(d: z.infer<typeof sponseeSchema>) {
  const year = Number(d.birthYear);
  const monthly = reaisToCents(d.monthlyReais);
  return {
    name: d.name,
    category: d.category,
    story: d.story,
    photoUrl: d.photoUrl || null,
    birthYear: Number.isInteger(year) && year > 1900 && year <= new Date().getFullYear() ? year : null,
    monthlyAmountCents: Number.isFinite(monthly) && monthly >= 100 ? monthly : 5000,
    campaignId: d.campaignId || null,
  };
}

export async function createSponsee(orgId: string, formData: FormData): Promise<SponseeResult> {
  let id: string;
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    await assertModule(orgId, "sponsees");
    const parsed = sponseeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    const row = await db.sponsee.create({ data: { organizationId: orgId, ...toData(parsed.data) }, select: { id: true } });
    id = row.id;
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${orgId}/sponsees`);
  redirect(`/orgs/${orgId}/sponsees/${id}`);
}

export async function updateSponsee(orgId: string, sponseeId: string, formData: FormData): Promise<SponseeResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = sponseeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    const existing = await db.sponsee.findFirst({ where: { id: sponseeId }, select: { id: true } });
    if (!existing) return { ok: false, error: "Afilhado não encontrado" };
    await db.sponsee.update({ where: { id: sponseeId }, data: toData(parsed.data) });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${orgId}/sponsees/${sponseeId}`);
  return { ok: true };
}

export async function setSponseeStatus(
  orgId: string,
  sponseeId: string,
  status: "AVAILABLE" | "RETIRED",
): Promise<SponseeResult> {
  try {
    const { db } = await requireOrgAccess(orgId, "EDITOR");
    const s = await db.sponsee.findFirst({ where: { id: sponseeId }, select: { status: true } });
    if (!s) return { ok: false, error: "Afilhado não encontrado" };
    if (s.status === "SPONSORED") return { ok: false, error: "Tem apadrinhamento ativo — cancele a recorrência primeiro." };
    await db.sponsee.update({ where: { id: sponseeId }, data: { status } });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${orgId}/sponsees/${sponseeId}`);
  return { ok: true };
}

const updateSchema = z.object({
  title: z.string().min(2).max(140),
  body: z.string().min(10).max(6000),
  photoUrl: z.string().url().optional().or(z.literal("")),
});

/** Publish a progress update and e-mail the current sponsor. */
export async function publishSponseeUpdate(
  orgId: string,
  sponseeId: string,
  formData: FormData,
): Promise<SponseeResult> {
  try {
    const { db, userId } = await requireOrgAccess(orgId, "EDITOR");
    const parsed = updateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    const sponsee = await db.sponsee.findFirst({
      where: { id: sponseeId },
      select: { name: true, sponsorDonorId: true, organization: { select: { displayName: true } } },
    });
    if (!sponsee) return { ok: false, error: "Afilhado não encontrado" };

    await db.sponseeUpdate.create({
      data: {
        sponseeId,
        title: parsed.data.title,
        body: parsed.data.body,
        photoUrl: parsed.data.photoUrl || null,
        createdBy: userId,
      },
    });

    if (sponsee.sponsorDonorId) {
      const sponsor = await prisma.donor.findUnique({
        where: { id: sponsee.sponsorDonorId },
        select: { name: true, email: true },
      });
      if (sponsor) {
        await sendEmail(
          sponsor.email,
          sponseeUpdateEmail({
            sponsorName: sponsor.name,
            sponseeName: sponsee.name,
            orgName: sponsee.organization.displayName,
            title: parsed.data.title,
            body: parsed.data.body,
            photoUrl: parsed.data.photoUrl || undefined,
          }),
        );
      }
    }
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${orgId}/sponsees/${sponseeId}`);
  return { ok: true };
}

// useActionState adapters
export async function createSponseeFormAction(orgId: string, _prev: SponseeResult | null, fd: FormData) {
  return createSponsee(orgId, fd);
}
export async function updateSponseeFormAction(
  orgId: string,
  sponseeId: string,
  _prev: SponseeResult | null,
  fd: FormData,
) {
  return updateSponsee(orgId, sponseeId, fd);
}
export async function publishUpdateFormAction(
  orgId: string,
  sponseeId: string,
  _prev: SponseeResult | null,
  fd: FormData,
) {
  return publishSponseeUpdate(orgId, sponseeId, fd);
}
