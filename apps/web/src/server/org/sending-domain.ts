"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { Prisma } from "@donation/db";
import {
  createSendingDomain,
  getSendingDomain,
  removeSendingDomain,
  triggerSendingDomainVerify,
} from "@donation/emails";
import { requireOrgAccess } from "@/server/auth-helpers";
import type { OrgResult } from "./email-config";

// A subdomain: at least 3 labels, lowercase, no scheme/path.
const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?!-)[a-z0-9-]{1,63}(\.(?!-)[a-z0-9-]{1,63}){2,}$/, "Use um subdomínio, ex.: mail.suaong.org.br");

async function persist(
  db: Awaited<ReturnType<typeof requireOrgAccess>>["db"],
  organizationId: string,
  info: { id: string; name: string; status: string; records: unknown },
) {
  const verified = info.status === "VERIFIED";
  await db.organizationEmailConfig.upsert({
    where: { organizationId },
    create: {
      organizationId,
      sendingDomain: info.name,
      providerDomainId: info.id,
      domainStatus: info.status as never,
      dnsRecords: info.records as never,
      verifiedAt: verified ? new Date() : null,
    },
    update: {
      sendingDomain: info.name,
      providerDomainId: info.id,
      domainStatus: info.status as never,
      dnsRecords: info.records as never,
      verifiedAt: verified ? new Date() : null,
    },
  });
}

export async function addSendingDomain(
  organizationId: string,
  _prev: OrgResult | null,
  formData: FormData,
): Promise<OrgResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "ADMIN");
    const parsed = domainSchema.safeParse(formData.get("domain"));
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Domínio inválido" };

    const existing = await db.organizationEmailConfig.findUnique({
      where: { organizationId },
      select: { providerDomainId: true },
    });
    if (existing?.providerDomainId) {
      return { ok: false, error: "Já existe um domínio. Remova-o antes de adicionar outro." };
    }

    const info = await createSendingDomain(parsed.data);
    await persist(db, organizationId, info);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/settings`);
  return { ok: true };
}

/** Ask Resend to re-check DNS, then refresh our copy. */
export async function verifySendingDomain(organizationId: string): Promise<OrgResult> {
  return refreshDomain(organizationId, true);
}

/** Just pull the current status/records (poll button). */
export async function refreshSendingDomain(organizationId: string): Promise<OrgResult> {
  return refreshDomain(organizationId, false);
}

async function refreshDomain(organizationId: string, verify: boolean): Promise<OrgResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "ADMIN");
    const cfg = await db.organizationEmailConfig.findUnique({
      where: { organizationId },
      select: { providerDomainId: true },
    });
    if (!cfg?.providerDomainId) return { ok: false, error: "Nenhum domínio adicionado." };

    if (verify) await triggerSendingDomainVerify(cfg.providerDomainId);
    const info = await getSendingDomain(cfg.providerDomainId);
    await persist(db, organizationId, info);
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/settings`);
  return { ok: true };
}

export async function deleteSendingDomain(organizationId: string): Promise<OrgResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "ADMIN");
    const cfg = await db.organizationEmailConfig.findUnique({
      where: { organizationId },
      select: { providerDomainId: true },
    });
    if (cfg?.providerDomainId) {
      try {
        await removeSendingDomain(cfg.providerDomainId);
      } catch {
        /* already gone on Resend's side — clear ours anyway */
      }
    }
    await db.organizationEmailConfig.updateMany({
      where: { organizationId },
      data: {
        sendingDomain: null,
        providerDomainId: null,
        domainStatus: "NONE",
        dnsRecords: Prisma.DbNull,
        verifiedAt: null,
      },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/settings`);
  return { ok: true };
}
