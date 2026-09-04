import { notFound } from "next/navigation";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { CheckInScanner } from "@/components/CheckInScanner";
import { PageHeader } from "@/components/ui";

export default async function CheckInPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "EDITOR");
  const event = await db.event.findFirst({ where: { id: eventId }, select: { title: true } });
  if (!event) notFound();

  return (
    <>
      <PageHeader
        title={`Check-in — ${event.title}`}
        description="Valide o código do ingresso na entrada. Um ingresso só entra uma vez."
        back={{ href: `/orgs/${orgId}/events/${eventId}`, label: "Evento" }}
      />
      <CheckInScanner orgId={orgId} eventId={eventId} />
    </>
  );
}
