import Link from "next/link";
import { prisma } from "@donation/db";
import { requirePlatformAdminPage } from "@/server/admin-helpers";
import { presignDownload } from "@/server/storage";
import { isStorageConfigured } from "@/env";
import { AdminKycActions } from "@/components/AdminKycActions";
import { PageHeader, Card, CardBody, EmptyState, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const DOC_LABEL: Record<string, string> = {
  ESTATUTO: "Estatuto",
  ATA: "Ata",
  CARTAO_CNPJ: "Cartão CNPJ",
  DOC_RESPONSAVEL: "Doc. responsável",
  COMPROVANTE_BANCARIO: "Comprovante bancário",
};

export default async function AdminHome() {
  await requirePlatformAdminPage();

  const orgs = await prisma.organization.findMany({
    where: { kycStatus: { in: ["SUBMITTED", "IN_REVIEW", "REJECTED"] } },
    orderBy: { updatedAt: "asc" },
    select: {
      id: true,
      displayName: true,
      legalName: true,
      cnpj: true,
      status: true,
      kycStatus: true,
      gatewayRecipientId: true,
      kyc: {
        select: { contactEmail: true, legalRepName: true, legalRepDocument: true, bankAccount: true, rejectionReason: true },
      },
      kycDocuments: { select: { id: true, kind: true, storageKey: true, contentType: true } },
    },
  });

  const withUrls = await Promise.all(
    orgs.map(async (o) => ({
      ...o,
      docs: isStorageConfigured
        ? await Promise.all(o.kycDocuments.map(async (d) => ({ ...d, url: await presignDownload(d.storageKey) })))
        : o.kycDocuments.map((d) => ({ ...d, url: "" })),
    })),
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Back-office — fila de KYC"
        actions={
          <Link href="/admin/orgs" className="link text-sm">
            Organizações e planos →
          </Link>
        }
      />
      {withUrls.length === 0 && <EmptyState>Nada na fila.</EmptyState>}

      <div className="grid gap-4">
        {withUrls.map((o) => (
          <Card key={o.id}>
            <CardBody>
              <div className="flex items-center gap-2">
                <strong>{o.displayName}</strong>
                <span className="text-sm text-muted">({o.legalName})</span>
                <StatusBadge status={o.kycStatus} />
              </div>
              <div className="mt-1 text-sm text-muted">
                CNPJ {o.cnpj} · {o.kyc?.contactEmail} · resp. {o.kyc?.legalRepName} ({o.kyc?.legalRepDocument})
              </div>
              <div className="text-sm text-muted">
                status: {o.status} · recebedor: {o.gatewayRecipientId ?? "—"}
              </div>
              {o.kyc?.rejectionReason && (
                <div className="text-sm text-danger">Recusa anterior: {o.kyc.rejectionReason}</div>
              )}

              <ul className="my-3 flex flex-wrap gap-3">
                {o.docs.map((d) => (
                  <li key={d.id}>
                    {d.url ? (
                      <a href={d.url} target="_blank" rel="noreferrer" className="link text-sm">
                        {DOC_LABEL[d.kind] ?? d.kind} ↗
                      </a>
                    ) : (
                      <span className="text-sm text-muted">{DOC_LABEL[d.kind] ?? d.kind} (storage off)</span>
                    )}
                  </li>
                ))}
              </ul>

              <AdminKycActions orgId={o.id} />
            </CardBody>
          </Card>
        ))}
      </div>
    </main>
  );
}
