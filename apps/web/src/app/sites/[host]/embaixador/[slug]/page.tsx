import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma, resolveOrgPublicKey } from "@donation/db";
import { resolveTenant } from "@/server/tenant";
import { DEFAULT_ACCENT } from "@/blocks/accent";
import { isAmbassadorSlug } from "@/server/ambassadors/slug";
import { DonationCheckout } from "@/blocks/DonationCheckout";
import { PublicShell } from "@/components/public/PublicShell";

export const dynamic = "force-dynamic";

const brl = (c: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);

async function load(hostParam: string, slug: string) {
  const tenant = await resolveTenant(decodeURIComponent(hostParam));
  if (!tenant || tenant.kind !== "site" || !isAmbassadorSlug(slug)) return null;

  const amb = await prisma.campaignAmbassador.findFirst({
    where: { slug, organizationId: tenant.organizationId, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      headline: true,
      message: true,
      photoUrl: true,
      goalCents: true,
      raisedCents: true,
      donationsCount: true,
      campaign: {
        select: {
          slug: true,
          title: true,
          status: true,
          minAmountCents: true,
          suggestedAmountsCents: true,
          allowRecurring: true,
          allowTip: true,
          organization: { select: { displayName: true, branding: true, planId: true } },
        },
      },
    },
  });
  if (!amb || amb.campaign.status !== "PUBLISHED") return null;

  const plan = await prisma.plan.findUnique({
    where: { id: amb.campaign.organization.planId },
    select: { platformFeeBps: true },
  });
  const branding = (amb.campaign.organization.branding ?? {}) as { primaryColor?: string; logoUrl?: string };
  const pay = await resolveOrgPublicKey(tenant.organizationId);

  return {
    amb,
    campaign: amb.campaign,
    org: {
      displayName: amb.campaign.organization.displayName,
      logoUrl: branding.logoUrl ?? null,
      accent: branding.primaryColor ?? null,
    },
    accent: branding.primaryColor ?? DEFAULT_ACCENT,
    platformFeeBps: plan?.platformFeeBps ?? 490,
    pagarmePublicKey: pay.publicKey,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ host: string; slug: string }>;
}): Promise<Metadata> {
  const { host, slug } = await params;
  const data = await load(host, slug);
  return data
    ? { title: `${data.amb.name} — ${data.campaign.title}`, description: data.amb.headline ?? undefined }
    : { title: "Página de embaixador" };
}

export default async function AmbassadorPage({
  params,
}: {
  params: Promise<{ host: string; slug: string }>;
}) {
  const { host, slug } = await params;
  const data = await load(host, slug);
  if (!data) notFound();

  const { amb, campaign, accent, org } = data;
  const pct = amb.goalCents && amb.goalCents > 0 ? Math.min(100, Math.round((amb.raisedCents / amb.goalCents) * 100)) : null;

  return (
    <PublicShell org={org} width="lg">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          {amb.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={amb.photoUrl} alt={amb.name} className="mb-4 size-28 rounded-full object-cover" />
          )}
          <div className="eyebrow">Embaixador · {campaign.title}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{amb.name}</h1>
          {amb.headline && <p className="mt-1 text-base text-muted">{amb.headline}</p>}

          {(pct != null || amb.raisedCents > 0) && (
            <div className="mt-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold" style={{ color: accent }}>
                  {brl(amb.raisedCents)}
                </span>
                {amb.goalCents ? <span className="text-muted">meta {brl(amb.goalCents)}</span> : null}
              </div>
              {pct != null && (
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
                </div>
              )}
              <p className="mt-1.5 text-xs text-muted">
                {amb.donationsCount} {amb.donationsCount === 1 ? "doação" : "doações"} por esta página
              </p>
            </div>
          )}

          {amb.message && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted">{amb.message}</p>
          )}

          <a href={`/${campaign.slug}`} className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
            Ver a campanha completa →
          </a>
        </div>

        <div className="flex justify-center md:justify-end">
          <DonationCheckout
            campaignSlug={campaign.slug}
            minAmountCents={campaign.minAmountCents}
            suggestedAmountsCents={campaign.suggestedAmountsCents}
            methods={["PIX", "CREDIT_CARD", "BOLETO"]}
            allowRecurring={campaign.allowRecurring}
            allowTip={campaign.allowTip}
            tipLabel="Quero cobrir a taxa da plataforma"
            platformFeeBps={data.platformFeeBps}
            pagarmePublicKey={data.pagarmePublicKey}
            accentColor={accent}
            ambassadorId={amb.id}
            heading={`Doar pela campanha de ${amb.name.split(" ")[0]}`}
          />
        </div>
      </div>
    </PublicShell>
  );
}
