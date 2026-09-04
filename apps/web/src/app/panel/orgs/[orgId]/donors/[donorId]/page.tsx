import { notFound } from "next/navigation";
import { formatBRL } from "@donation/shared";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { getDonorTimeline } from "@/server/crm/timeline";
import { DonorTagsEditor } from "@/components/DonorTagsEditor";
import { RecurringCancelOrg } from "@/components/RecurringCancelOrg";
import { DonorTimeline } from "@/components/crm/DonorTimeline";
import { DonorRelationshipCard } from "@/components/crm/DonorRelationshipCard";
import { ContactLinks } from "@/components/crm/ContactLinks";
import { PageHeader, Card, CardBody, Table, Th, Td, Tr, StatusBadge } from "@/components/ui";

const toDateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function DonorDetail({
  params,
}: {
  params: Promise<{ orgId: string; donorId: string }>;
}) {
  const { orgId, donorId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "VIEWER");

  const donor = await db.donor.findFirst({
    where: { id: donorId },
    select: {
      name: true,
      email: true,
      phone: true,
      birthdate: true,
      ownerUserId: true,
      owner: { select: { name: true } },
      preferredChannel: true,
      totalDonatedCents: true,
      donationsCount: true,
      firstDonationAt: true,
      lastDonationAt: true,
      rfmSegment: true,
      consent: true,
      tags: { select: { tag: true } },
      donations: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          createdAt: true,
          amountCents: true,
          tipCents: true,
          method: true,
          status: true,
          recurringPlanId: true,
          campaign: { select: { title: true } },
        },
      },
      recurring: {
        where: { status: { in: ["ACTIVE", "PAST_DUE"] } },
        select: { id: true, amountCents: true, tipCents: true, interval: true, nextChargeAt: true, status: true },
      },
    },
  });
  if (!donor) notFound();

  const [members, timeline] = await Promise.all([
    db.membership.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
      select: { userId: true, user: { select: { name: true } } },
    }),
    getDonorTimeline(db, orgId, donorId),
  ]);
  const memberOpts = members.map((m) => ({ id: m.userId, name: m.user.name }));

  const consent = (donor.consent ?? {}) as { email?: boolean; whatsapp?: boolean; at?: string };
  const stats: [string, string][] = [
    [formatBRL(donor.totalDonatedCents), "total doado"],
    [String(donor.donationsCount), "doações"],
    [donor.rfmSegment ?? "—", "segmento RFM"],
    [donor.firstDonationAt?.toLocaleDateString("pt-BR") ?? "—", "primeira"],
    [donor.lastDonationAt?.toLocaleDateString("pt-BR") ?? "—", "última"],
  ];

  return (
    <>
      <PageHeader
        title={donor.name}
        description={`${donor.email}${donor.phone ? ` · ${donor.phone}` : ""}`}
        back={{ href: `/orgs/${orgId}/donors`, label: "Doadores" }}
        actions={<ContactLinks email={donor.email} phone={donor.phone} />}
      />

      <section className="mb-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
        {stats.map(([v, l]) => (
          <div key={l}>
            <strong className="tabular-nums">{v}</strong>
            <div className="text-xs text-muted">{l}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        {/* Main column — activity */}
        <div className="min-w-0 space-y-4 lg:order-1">
          <h2 className="text-sm font-semibold">Linha do tempo</h2>
          <DonorTimeline orgId={orgId} donorId={donorId} items={timeline} members={memberOpts} />

          <Card>
            <CardBody className="pb-0">
              <h2 className="text-sm font-semibold">Todas as doações</h2>
            </CardBody>
            <Table>
              <thead>
                <Tr>
                  <Th>Data</Th>
                  <Th>Campanha</Th>
                  <Th>Método</Th>
                  <Th>Valor</Th>
                  <Th>Status</Th>
                </Tr>
              </thead>
              <tbody>
                {donor.donations.map((x) => (
                  <Tr key={x.id}>
                    <Td>{x.createdAt.toLocaleDateString("pt-BR")}</Td>
                    <Td>
                      {x.campaign?.title ?? "—"}
                      {x.recurringPlanId ? " (recorrente)" : ""}
                    </Td>
                    <Td>{x.method}</Td>
                    <Td className="tabular-nums">{formatBRL(x.amountCents + x.tipCents)}</Td>
                    <Td>
                      <StatusBadge status={x.status} />
                    </Td>
                  </Tr>
                ))}
                {donor.donations.length === 0 && (
                  <Tr>
                    <Td colSpan={5} className="text-muted">
                      Nenhuma doação registrada.
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          </Card>
        </div>

        {/* Side column — profile */}
        <aside className="space-y-4 lg:order-2">
          <DonorRelationshipCard
            orgId={orgId}
            donorId={donorId}
            members={memberOpts}
            owner={donor.owner?.name ?? null}
            ownerUserId={donor.ownerUserId}
            preferredChannel={donor.preferredChannel}
            birthdate={toDateInput(donor.birthdate)}
          />

          <div className="card p-4">
            <h2 className="mb-2 text-sm font-semibold">Tags</h2>
            <DonorTagsEditor orgId={orgId} donorId={donorId} tags={donor.tags.map((t) => t.tag)} />
          </div>

          {donor.recurring.length > 0 && (
            <div className="card p-4">
              <h2 className="mb-2 text-sm font-semibold">Doações recorrentes</h2>
              <ul className="space-y-2 text-sm">
                {donor.recurring.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      {formatBRL(r.amountCents + r.tipCents)} / {r.interval === "YEARLY" ? "ano" : "mês"}
                    </span>
                    <StatusBadge status={r.status} />
                    <span className="text-muted">próxima {r.nextChargeAt.toLocaleDateString("pt-BR")}</span>
                    <RecurringCancelOrg orgId={orgId} planId={r.id} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card p-4">
            <h2 className="mb-1 text-sm font-semibold">Consentimento (LGPD)</h2>
            <p className="text-sm text-muted">
              E-mail: {consent.email ? "sim" : "não"} · WhatsApp: {consent.whatsapp ? "sim" : "não"}
              {consent.at ? ` · registrado em ${new Date(consent.at).toLocaleString("pt-BR")}` : ""}
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
