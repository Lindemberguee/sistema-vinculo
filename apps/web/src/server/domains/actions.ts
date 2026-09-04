"use server";

import { randomBytes } from "node:crypto";
import { resolveCname, resolveTxt } from "node:dns/promises";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { getOrgLimits } from "@donation/db";
import { requireOrgAccess } from "@/server/auth-helpers";
import { CNAME_TARGET, PLATFORM_BASE_DOMAIN as BASE } from "@/server/domains/config";

export interface DomainResult {
  ok: boolean;
  error?: string;
  verified?: boolean;
}

const hostSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((h) => h.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
  .pipe(z.string().regex(/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/, "Domínio inválido"));

export async function addCustomDomain(organizationId: string, rawHost: string): Promise<DomainResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "OWNER");

    const parsed = hostSchema.safeParse(rawHost);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Domínio inválido" };
    const host = parsed.data;
    if (host === BASE || host.endsWith(`.${BASE}`)) {
      return { ok: false, error: "Use um domínio próprio, não um subdomínio da plataforma" };
    }

    const limits = await getOrgLimits(organizationId);
    if (!limits.customDomain) return { ok: false, error: "Seu plano não inclui domínio próprio" };

    await db.customDomain.create({
      data: { organizationId, host, verificationToken: randomBytes(16).toString("hex"), sslStatus: "PENDING" },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return { ok: false, error: "Este domínio já está cadastrado" };
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/domains`);
  return { ok: true };
}

export async function verifyCustomDomain(organizationId: string, domainId: string): Promise<DomainResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "OWNER");
    const domain = await db.customDomain.findFirst({
      where: { id: domainId },
      select: { host: true, verificationToken: true },
    });
    if (!domain) return { ok: false, error: "Domínio não encontrado" };

    let verified = false;

    // Accept either a CNAME to our target or a TXT verification record.
    try {
      const cnames = await resolveCname(domain.host);
      if (cnames.some((c) => c.toLowerCase().replace(/\.$/, "") === CNAME_TARGET)) verified = true;
    } catch {
      /* no CNAME — fall through to TXT */
    }
    if (!verified) {
      try {
        const txt = await resolveTxt(`_donation-verify.${domain.host}`);
        if (txt.flat().includes(domain.verificationToken)) verified = true;
      } catch {
        /* no TXT */
      }
    }

    if (!verified) {
      return { ok: false, verified: false, error: "DNS ainda não aponta para a plataforma. Pode levar até alguns minutos." };
    }

    await db.customDomain.update({
      where: { id: domainId },
      // SSL issuance is handled by the edge/proxy (Vercel Domains API or Caddy
      // on-demand TLS); we mark it optimistically once DNS resolves.
      data: { verifiedAt: new Date(), sslStatus: "ISSUED" },
    });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/domains`);
  return { ok: true, verified: true };
}

export async function removeCustomDomain(organizationId: string, domainId: string): Promise<DomainResult> {
  try {
    const { db } = await requireOrgAccess(organizationId, "OWNER");
    const domain = await db.customDomain.findFirst({ where: { id: domainId }, select: { id: true } });
    if (!domain) return { ok: false, error: "Domínio não encontrado" };
    await db.customDomain.deleteMany({ where: { id: domainId } });
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/panel/orgs/${organizationId}/domains`);
  return { ok: true };
}
