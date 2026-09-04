import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "./index";

export interface OrgSender {
  /** Ready-to-use From header. */
  from: string;
  replyTo?: string;
}

function platformFromAddress(): string {
  const domain = process.env.EMAIL_SENDING_DOMAIN;
  if (domain) return `no-reply@${domain}`;
  // Fall back to whatever EMAIL_FROM's address is, else a safe placeholder.
  const m = /<([^>]+)>/.exec(process.env.EMAIL_FROM ?? "");
  return m?.[1] ?? "no-reply@example.com";
}

/** Sanitise a display name for a From header (no quotes / control chars / commas). */
function safeName(name: string): string {
  return name.replace(/["\r\n]/g, "").replace(/,/g, " ").trim().slice(0, 78) || "Doações";
}

/**
 * The From / Reply-To an organization's e-mails should use. Falls back to the
 * platform sending domain until the org verifies its own domain (mode C).
 */
export async function resolveOrgSender(organizationId: string): Promise<OrgSender> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      displayName: true,
      emailConfig: {
        select: { fromName: true, replyTo: true, sendingDomain: true, domainStatus: true },
      },
      kyc: { select: { contactEmail: true } },
    },
  });

  const cfg = org?.emailConfig;
  const name = safeName(cfg?.fromName || org?.displayName || "Doações");
  const address =
    cfg?.domainStatus === "VERIFIED" && cfg.sendingDomain
      ? `no-reply@${cfg.sendingDomain}`
      : platformFromAddress();
  const replyTo = cfg?.replyTo || org?.kyc?.contactEmail || undefined;

  return { from: `${name} <${address}>`, replyTo };
}

// ── One-click unsubscribe token (stateless, HMAC-signed) ──────────────

function unsubKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for unsubscribe tokens");
  return Buffer.from(secret);
}

/** `<orgId>.<donorId>.<hmac>` → base64url. Opaque, tamper-evident, no DB row. */
export function signUnsubscribe(organizationId: string, donorId: string): string {
  const body = `${organizationId}.${donorId}`;
  const sig = createHmac("sha256", unsubKey()).update(body).digest("base64url").slice(0, 24);
  return Buffer.from(`${body}.${sig}`).toString("base64url");
}

export function verifyUnsubscribe(token: string): { organizationId: string; donorId: string } | null {
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const parts = decoded.split(".");
  if (parts.length !== 3) return null;
  const [organizationId, donorId, sig] = parts as [string, string, string];
  const expected = createHmac("sha256", unsubKey()).update(`${organizationId}.${donorId}`).digest("base64url").slice(0, 24);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { organizationId, donorId };
}
