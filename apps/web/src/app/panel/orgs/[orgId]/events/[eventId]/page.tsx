import Link from "next/link";
import { notFound } from "next/navigation";
import { formatBRL } from "@donation/shared";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { EventForm } from "@/components/EventForm";
import { EventStatusControls, TicketTypeManager } from "@/components/EventControls";
import { PublicLinkCard } from "@/components/panel/PublicLinkCard";
import { PageHeader, Card, CardBody, StatusBadge, Stat, LinkButton } from "@/components/ui";

const toLocalInput = (d: Date | null) =>
  d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

export default async function EventDetail({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "EDITOR");

  const [event, campaigns] = await Promise.all([
    db.event.findFirst({
      where: { id: eventId },
      select: {
        title: true,
        description: true,
        venue: true,
        address: true,
        startsAt: true,
        endsAt: true,
        campaignId: true,
        status: true,
        organization: { select: { slug: true } },
        ticketTypes: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, priceCents: true, quantity: true, sold: true, maxPerOrder: true },
        },
      },
    }),
    db.campaign.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  if (!event) notFound();

  const [valid, used] = await Promise.all([
    db.eventTicket.count({ where: { eventId, status: "VALID" } }),
    db.eventTicket.count({ where: { eventId, status: "USED" } }),
  ]);
  const revenue = event.ticketTypes.reduce((s, t) => s + t.sold * t.priceCents, 0);

  return (
    <>
      <PageHeader
        title={event.title}
        back={{ href: `/orgs/${orgId}/events`, label: "Eventos" }}
        actions={
          <>
            <StatusBadge status={event.status} />
            <LinkButton href={`/orgs/${orgId}/events/${eventId}/checkin`} size="sm" variant="secondary">
              Check-in
            </LinkButton>
            <a
              href={`/orgs/${orgId}/events/${eventId}/participants`}
              className="btn-secondary btn-sm no-underline"
              download
            >
              Exportar participantes
            </a>
          </>
        }
      />

      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Ingressos válidos" value={valid} />
          <Stat label="Já utilizados" value={used} />
          <Stat label="Receita" value={formatBRL(revenue)} />
          <Stat label="Início" value={event.startsAt.toLocaleDateString("pt-BR")} />
        </div>

        <Card>
          <CardBody>
            <h2 className="mb-2 text-sm font-semibold">Status</h2>
            <EventStatusControls orgId={orgId} eventId={eventId} status={event.status} />
          </CardBody>
        </Card>

        <PublicLinkCard
          orgSlug={event.organization.slug}
          path={`/evento/${eventId}`}
          note="Link direto pra compra de ingressos — funciona sem montar página de campanha."
        />

        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold">Tipos de ingresso</h2>
            <TicketTypeManager orgId={orgId} eventId={eventId} types={event.ticketTypes} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold">Dados do evento</h2>
            <EventForm
              orgId={orgId}
              eventId={eventId}
              campaigns={campaigns}
              initial={{
                title: event.title,
                description: event.description,
                venue: event.venue,
                address: event.address ?? "",
                startsAt: toLocalInput(event.startsAt),
                endsAt: toLocalInput(event.endsAt),
                campaignId: event.campaignId ?? "",
              }}
            />
            <p className="mt-2 hint">
              ID do evento (use no bloco “Ingressos de evento”): <code>{eventId}</code>
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
