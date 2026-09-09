import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma, parsePlanLimits, type CampaignCategory } from "@donation/db";
import { formatBRL } from "@donation/shared";
import { resolveTenant } from "@/server/tenant";
import { DEFAULT_ACCENT } from "@/blocks/accent";
import { categoryLabel, CAMPAIGN_CATEGORIES } from "@/lib/campaign-category";

export const revalidate = 600;

async function loadOrg(hostParam: string) {
  const tenant = await resolveTenant(decodeURIComponent(hostParam));
  if (!tenant || tenant.kind !== "site") return null;
  const org = await prisma.organization.findUnique({
    where: { id: tenant.organizationId },
    select: { id: true, displayName: true, branding: true, planId: true },
  });
  if (!org) return null;
  const plan = await prisma.plan.findUnique({ where: { id: org.planId }, select: { limits: true } });
  return { ...org, removeBranding: parsePlanLimits(plan?.limits).removeBranding };
}

export async function generateMetadata({ params }: { params: Promise<{ host: string }> }): Promise<Metadata> {
  const { host } = await params;
  const org = await loadOrg(host);
  return org ? { title: `${org.displayName} — Campanhas` } : { title: "Não encontrado" };
}

export default async function OrgDirectory({
  params,
  searchParams,
}: {
  params: Promise<{ host: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { host } = await params;
  const sp = await searchParams;
  const org = await loadOrg(host);
  if (!org) notFound();

  const catParam = (Array.isArray(sp.categoria) ? sp.categoria[0] : sp.categoria) ?? "";
  const cat = CAMPAIGN_CATEGORIES.some((c) => c.value === catParam && c.value !== "NONE") ? catParam : "";
  const branding = (org.branding ?? {}) as { primaryColor?: string; logoUrl?: string };
  const accent = branding.primaryColor ?? DEFAULT_ACCENT;

  const campaigns = await prisma.campaign.findMany({
    where: {
      organizationId: org.id,
      status: "PUBLISHED",
      hiddenFromDirectory: false,
      ...(cat ? { category: cat as CampaignCategory } : {}),
    },
    orderBy: [{ raisedCents: "desc" }, { createdAt: "desc" }],
    take: 60,
    select: {
      slug: true,
      title: true,
      slogan: true,
      category: true,
      coverImageUrl: true,
      raisedCents: true,
      offPlatformCents: true,
      goalCents: true,
      donorsCount: true,
    },
  });

  // Categories that actually have campaigns, for the filter row.
  const present = new Set<string>(campaigns.map((c) => c.category));
  const usedCategories = CAMPAIGN_CATEGORIES.filter(
    (c) => c.value !== "NONE" && (present.has(c.value) || c.value === cat),
  );

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3 sm:px-6">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={org.displayName} className="h-8 w-auto object-contain" />
          ) : (
            <span
              className="grid size-8 place-items-center rounded-md text-sm font-semibold text-white"
              style={{ background: accent }}
            >
              {org.displayName.trim().charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate text-base font-semibold">{org.displayName}</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-14">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Campanhas</h1>
        <p className="mt-1.5 text-sm text-muted">Escolha uma causa para apoiar.</p>

        {usedCategories.length > 0 && (
          <nav className="mt-6 flex flex-wrap gap-2">
            <FilterChip href="/" label="Todas" active={!cat} accent={accent} />
            {usedCategories.map((c) => (
              <FilterChip
                key={c.value}
                href={`/?categoria=${c.value}`}
                label={c.label}
                active={cat === c.value}
                accent={accent}
              />
            ))}
          </nav>
        )}

        {campaigns.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
            <p className="text-sm font-medium text-ink">Nenhuma campanha publicada no momento</p>
            <p className="mt-1 text-sm text-muted">Volte em breve para acompanhar as novidades.</p>
          </div>
        ) : (
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => {
              const raised = c.raisedCents + c.offPlatformCents;
              const pct = c.goalCents ? Math.min(100, Math.round((raised / c.goalCents) * 100)) : null;
              return (
                <Link
                  key={c.slug}
                  href={`/${c.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface no-underline shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop"
                >
                  <div className="aspect-[16/9] w-full overflow-hidden bg-canvas">
                    {c.coverImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.coverImageUrl}
                        alt={c.title}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    {c.category !== "NONE" && (
                      <span className="mb-1.5 w-fit rounded-full bg-canvas px-2 py-0.5 text-2xs font-medium text-muted">
                        {categoryLabel(c.category)}
                      </span>
                    )}
                    <div className="font-semibold text-ink">{c.title}</div>
                    {c.slogan && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{c.slogan}</p>}
                    <div className="mt-3 flex-1" />
                    {pct !== null && (
                      <div className="mb-1.5 h-2 overflow-hidden rounded-full bg-canvas">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
                      </div>
                    )}
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-semibold text-ink tabular-nums">{formatBRL(raised)}</span>
                      <span className="text-muted">{c.donorsCount} apoios</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {!org.removeBranding && (
        <footer className="border-t border-line bg-surface py-5 text-center text-xs text-faint">
          Feito com a plataforma de doações.
        </footer>
      )}
    </div>
  );
}

function FilterChip({
  href,
  label,
  active,
  accent,
}: {
  href: string;
  label: string;
  active: boolean;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="min-h-9 rounded-full border px-3.5 py-1.5 text-xs font-medium no-underline transition-colors"
      style={
        active
          ? { borderColor: accent, background: accent, color: "white" }
          : { borderColor: "var(--color-line-strong)", color: "var(--color-muted)" }
      }
    >
      {label}
    </Link>
  );
}
