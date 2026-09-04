import { prisma } from "@donation/db";

export type TenantContext =
  | { kind: "panel" } // app.<base> — tenant comes from the session
  | { kind: "admin" } // admin.<base> — platform back-office
  | { kind: "site"; organizationId: string; slug: string; host: string }; // public pages

const BASE_DOMAIN = process.env.APP_BASE_DOMAIN ?? "localhost:3000";

/** Strip port and normalize. */
function normalizeHost(host: string): string {
  return host.toLowerCase().split(":")[0]!.replace(/\.$/, "");
}

/**
 * Resolve a request host to a tenant context.
 * Called from middleware (edge-safe subset) and from RSC loaders.
 */
export async function resolveTenant(rawHost: string): Promise<TenantContext | null> {
  const host = normalizeHost(rawHost);
  const base = normalizeHost(BASE_DOMAIN);

  if (host === `app.${base}` || host === base) return { kind: "panel" };
  if (host === `admin.${base}`) return { kind: "admin" };

  // {slug}.<base>  → public site by org slug
  if (host.endsWith(`.${base}`)) {
    const slug = host.slice(0, -1 * (base.length + 1));
    if (!slug || slug.includes(".")) return null;
    const org = await prisma.organization.findUnique({ where: { slug }, select: { id: true, status: true } });
    if (!org || org.status === "SUSPENDED") return null;
    return { kind: "site", organizationId: org.id, slug, host };
  }

  // Custom domain (CNAME) → lookup CustomDomain
  const domain = await prisma.customDomain.findUnique({
    where: { host },
    select: { organizationId: true, verifiedAt: true, organization: { select: { slug: true, status: true } } },
  });
  if (domain?.verifiedAt && domain.organization.status !== "SUSPENDED") {
    return { kind: "site", organizationId: domain.organizationId, slug: domain.organization.slug, host };
  }

  return null;
}
