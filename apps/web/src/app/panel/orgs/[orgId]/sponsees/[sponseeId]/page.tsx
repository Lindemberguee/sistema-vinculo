import { notFound } from "next/navigation";
import { formatBRL } from "@donation/shared";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { SponseeForm } from "@/components/SponseeForm";
import { SponseeUpdateForm } from "@/components/SponseeUpdateForm";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";

const centsToReais = (n: number) => (n / 100).toString().replace(".", ",");

export default async function SponseeDetail({
  params,
}: {
  params: Promise<{ orgId: string; sponseeId: string }>;
}) {
  const { orgId, sponseeId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "EDITOR");

  const [sponsee, campaigns] = await Promise.all([
    db.sponsee.findFirst({
      where: { id: sponseeId },
      select: {
        name: true,
        category: true,
        story: true,
        photoUrl: true,
        birthYear: true,
        monthlyAmountCents: true,
        status: true,
        sponsoredAt: true,
        campaignId: true,
        sponsorDonorId: true,
        updates: { orderBy: { createdAt: "desc" }, select: { id: true, title: true, body: true, createdAt: true } },
      },
    }),
    db.campaign.findMany({ where: { type: "APADRINHAMENTO" }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  if (!sponsee) notFound();

  const sponsor = sponsee.sponsorDonorId
    ? await db.donor.findFirst({ where: { id: sponsee.sponsorDonorId }, select: { name: true, email: true } })
    : null;

  return (
    <>
      <PageHeader
        title={sponsee.name}
        back={{ href: `/orgs/${orgId}/sponsees`, label: "Apadrinhamento" }}
        actions={<Badge tone={sponsee.status === "SPONSORED" ? "success" : sponsee.status === "AVAILABLE" ? "warn" : "neutral"}>{sponsee.status}</Badge>}
      />

      <div className="grid gap-4">
        <Card>
          <CardBody>
            <h2 className="mb-1 text-sm font-semibold">Padrinho atual</h2>
            {sponsor ? (
              <p className="text-sm">
                {sponsor.name} <span className="text-muted">· {sponsor.email}</span>
                {sponsee.sponsoredAt && (
                  <span className="text-muted"> · desde {sponsee.sponsoredAt.toLocaleDateString("pt-BR")}</span>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted">Sem padrinho no momento.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold">Dados</h2>
            <SponseeForm
              orgId={orgId}
              sponseeId={sponseeId}
              campaigns={campaigns}
              initial={{
                name: sponsee.name,
                category: sponsee.category,
                story: sponsee.story,
                photoUrl: sponsee.photoUrl ?? "",
                birthYear: sponsee.birthYear ? String(sponsee.birthYear) : "",
                monthlyReais: centsToReais(sponsee.monthlyAmountCents),
                campaignId: sponsee.campaignId ?? "",
              }}
            />
            <p className="mt-2 hint">Valor mensal sugerido: {formatBRL(sponsee.monthlyAmountCents)}</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold">Publicar atualização</h2>
            <p className="mb-3 hint">Vai por e-mail para o padrinho atual (se houver).</p>
            <SponseeUpdateForm orgId={orgId} sponseeId={sponseeId} />
          </CardBody>
        </Card>

        {sponsee.updates.length > 0 && (
          <Card>
            <CardBody>
              <h2 className="mb-3 text-sm font-semibold">Histórico de atualizações</h2>
              <ul className="grid gap-3">
                {sponsee.updates.map((u) => (
                  <li key={u.id} className="border-b border-line pb-3 last:border-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <strong className="text-sm">{u.title}</strong>
                      <span className="text-xs text-muted">{u.createdAt.toLocaleDateString("pt-BR")}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-muted">{u.body}</p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
