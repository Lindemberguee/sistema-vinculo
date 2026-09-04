import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@donation/db";
import { resolveTenant } from "@/server/tenant";
import { PublicShell } from "@/components/public/PublicShell";
import { AmbassadorManageForm } from "@/components/ambassadors/AmbassadorManageForm";

export const dynamic = "force-dynamic";

const brl = (c: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);
const reais = (n: number | null) => (n ? (n / 100).toString().replace(".", ",") : "");

export const metadata: Metadata = { title: "Minha página de embaixador", robots: { index: false } };

export default async function AmbassadorManagePage({
  params,
}: {
  params: Promise<{ host: string; token: string }>;
}) {
  const { host, token } = await params;
  const tenant = await resolveTenant(decodeURIComponent(host));
  if (!tenant || tenant.kind !== "site" || token.length < 10) notFound();

  const amb = await prisma.campaignAmbassador.findFirst({
    where: { manageToken: token, organizationId: tenant.organizationId },
    select: {
      slug: true,
      name: true,
      headline: true,
      message: true,
      goalCents: true,
      photoUrl: true,
      raisedCents: true,
      donationsCount: true,
      status: true,
      campaign: { select: { title: true, organization: { select: { displayName: true, branding: true } } } },
    },
  });
  if (!amb || amb.status === "BLOCKED") notFound();

  const branding = (amb.campaign.organization.branding ?? {}) as { primaryColor?: string; logoUrl?: string };
  const org = {
    displayName: amb.campaign.organization.displayName,
    logoUrl: branding.logoUrl ?? null,
    accent: branding.primaryColor ?? null,
  };
  const scheme = tenant.host.includes("localhost") ? "http" : "https";
  const publicUrl = `${scheme}://${tenant.host}/embaixador/${amb.slug}`;

  return (
    <PublicShell org={org} width="md">
      <div className="space-y-5">
        <div>
          <div className="eyebrow">Embaixador · {amb.campaign.title}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Olá, {amb.name.split(" ")[0]}</h1>
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-line bg-surface p-4 text-center">
          <div>
            <div className="text-xs text-faint">Arrecadado</div>
            <div className="text-sm font-semibold tabular-nums">{brl(amb.raisedCents)}</div>
          </div>
          <div>
            <div className="text-xs text-faint">Doações</div>
            <div className="text-sm font-semibold tabular-nums">{amb.donationsCount}</div>
          </div>
          <div>
            <div className="text-xs text-faint">Meta</div>
            <div className="text-sm font-semibold tabular-nums">{amb.goalCents ? brl(amb.goalCents) : "—"}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm">Seu link para divulgar:</p>
          <code className="mt-1.5 block truncate rounded-md bg-canvas px-2.5 py-1.5 text-xs">{publicUrl}</code>
          <a href={publicUrl} className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline">
            Abrir minha página →
          </a>
        </div>

        {amb.status === "HIDDEN" && (
          <p className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">
            Sua página está oculta pela organização no momento — o link ainda funciona, mas ela não aparece no ranking.
          </p>
        )}

        <AmbassadorManageForm
          token={token}
          initial={{
            headline: amb.headline ?? "",
            message: amb.message ?? "",
            goalReais: reais(amb.goalCents),
            photoUrl: amb.photoUrl ?? "",
          }}
        />
      </div>
    </PublicShell>
  );
}
