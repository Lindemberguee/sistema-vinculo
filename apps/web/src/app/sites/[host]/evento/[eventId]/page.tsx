import { notFound } from "next/navigation";
import { prisma, resolveOrgPublicKey } from "@donation/db";
import { resolveTenant } from "@/server/tenant";
import { DEFAULT_ACCENT } from "@/blocks/accent";
import { PublicShell } from "@/components/public/PublicShell";
import { EventCheckout } from "@/blocks/EventCheckout";
import { Alert } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ host: string; eventId: string }> }) {
  const { host, eventId } = await params;
  const tenant = await resolveTenant(decodeURIComponent(host));
  if (!tenant || tenant.kind !== "site") return {};
  const ev = await prisma.event.findFirst({
    where: { id: eventId, organizationId: tenant.organizationId },
    select: { title: true, description: true },
  });
  return ev ? { title: ev.title, description: ev.description.slice(0, 160) } : {};
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ host: string; eventId: string }>;
}) {
  const { host, eventId } = await params;
  const tenant = await resolveTenant(decodeURIComponent(host));
  if (!tenant || tenant.kind !== "site") notFound();

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: tenant.organizationId },
    select: {
      title: true,
      description: true,
      venue: true,
      address: true,
      startsAt: true,
      endsAt: true,
      status: true,
      ticketTypes: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, priceCents: true, quantity: true, sold: true, maxPerOrder: true },
      },
      organization: { select: { displayName: true, branding: true, planId: true } },
    },
  });
  if (!event) notFound();

  const branding = (event.organization.branding ?? {}) as { logoUrl?: string; primaryColor?: string };
  const accent = branding.primaryColor ?? DEFAULT_ACCENT;
  const [plan, pay] = await Promise.all([
    prisma.plan.findUnique({ where: { id: event.organization.planId }, select: { platformFeeBps: true } }),
    resolveOrgPublicKey(tenant.organizationId),
  ]);

  return (
    <PublicShell
      org={{ displayName: event.organization.displayName, logoUrl: branding.logoUrl, accent }}
      width="lg"
    >
      <p className="eyebrow">Evento</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{event.title}</h1>
      <p className="mt-1 text-sm text-muted">
        {event.venue}
        {event.address ? ` — ${event.address}` : ""} · {event.startsAt.toLocaleString("pt-BR")}
      </p>
      {event.description && (
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink">{event.description}</p>
      )}

      <div className="mt-6">
        {event.status === "PUBLISHED" ? (
          <div className="flex justify-center">
            <EventCheckout
              eventId={eventId}
              eventTitle={event.title}
              venue={event.venue}
              startsAtLabel={event.startsAt.toLocaleString("pt-BR")}
              askAttendeeNames
              ticketTypes={event.ticketTypes.map((t) => ({
                id: t.id,
                name: t.name,
                priceCents: t.priceCents,
                available: Math.max(0, t.quantity - t.sold),
                maxPerOrder: t.maxPerOrder,
              }))}
              allowTip
              tipLabel="Quero cobrir a taxa da plataforma"
              platformFeeBps={plan?.platformFeeBps ?? 490}
              pagarmePublicKey={pay.publicKey}
              accentColor={accent}
            />
          </div>
        ) : (
          <Alert tone="warn">
            {event.status === "ENDED" ? "As vendas deste evento foram encerradas." : "As vendas ainda não estão abertas."}
          </Alert>
        )}
      </div>
    </PublicShell>
  );
}
