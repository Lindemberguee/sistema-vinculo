import { requireOrgAccessPage } from "@/server/auth-helpers";
import { CNAME_TARGET } from "@/server/domains/config";
import { CustomDomainsPanel } from "@/components/CustomDomainsPanel";
import { SendingDomainCard } from "@/components/crm/SendingDomainCard";
import { PageHeader } from "@/components/ui";

type DnsRecord = { type: string; name: string; value: string; ttl?: string; priority?: number };

export default async function DomainsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "ADMIN");

  const [domains, emailCfg] = await Promise.all([
    db.customDomain.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, host: true, verificationToken: true, verifiedAt: true, sslStatus: true },
    }),
    db.organizationEmailConfig.findUnique({
      where: { organizationId: orgId },
      select: { sendingDomain: true, domainStatus: true, dnsRecords: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Domínios"
        description="Endereços próprios da sua organização — um para as páginas de campanha, outro para o envio de e-mails. São coisas diferentes e independentes."
        back={{ href: `/orgs/${orgId}/settings`, label: "Configurações" }}
      />

      <div className="space-y-8">
        <section>
          <h2 className="text-sm font-semibold">Domínio das páginas</h2>
          <p className="mt-0.5 mb-3 text-sm text-muted">
            Serve as campanhas num endereço seu, ex.: <code>doe.suaong.org.br</code> (CNAME + SSL). Disponível no
            plano Pro.
          </p>
          <CustomDomainsPanel
            orgId={orgId}
            cnameTarget={CNAME_TARGET}
            domains={domains.map((d) => ({ ...d, verifiedAt: d.verifiedAt?.toISOString() ?? null }))}
          />
        </section>

        <section>
          <h2 className="text-sm font-semibold">Domínio de e-mail</h2>
          <p className="mt-0.5 mb-3 text-sm text-muted">
            Faz os e-mails saírem de um endereço seu, ex.: <code>mail.suaong.org.br</code> (SPF + DKIM + MX). Melhora a
            entrega e coloca a sua marca no remetente.
          </p>
          <SendingDomainCard
            orgId={orgId}
            domain={emailCfg?.sendingDomain ?? null}
            status={emailCfg?.domainStatus ?? "NONE"}
            records={Array.isArray(emailCfg?.dnsRecords) ? (emailCfg!.dnsRecords as unknown as DnsRecord[]) : []}
          />
        </section>
      </div>
    </>
  );
}
