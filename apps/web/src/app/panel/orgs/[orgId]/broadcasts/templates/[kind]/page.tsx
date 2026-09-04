import { notFound } from "next/navigation";
import { EMAIL_TEMPLATE_KINDS, type EmailTemplateKind } from "@donation/emails";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { getEmailTemplate, TEMPLATE_SAMPLE } from "@/server/crm/email-templates-queries";
import { EmailBuilder } from "@/components/email-builder/EmailBuilder";
import { PageHeader } from "@/components/ui";

export default async function EmailTemplateEditorPage({
  params,
}: {
  params: Promise<{ orgId: string; kind: string }>;
}) {
  const { orgId, kind: kindRaw } = await params;
  const kind = kindRaw as EmailTemplateKind;
  if (!(EMAIL_TEMPLATE_KINDS as string[]).includes(kind)) notFound();

  const { db } = await requireOrgAccessPage(orgId, "ADMIN");
  const t = await getEmailTemplate(db, orgId, kind);
  if (!t) notFound();

  return (
    <>
      <PageHeader
        title={t.meta.label}
        description={t.meta.description}
        back={{ href: `/orgs/${orgId}/broadcasts/templates`, label: "Templates de e-mail" }}
      />

      <EmailBuilder
        orgId={orgId}
        kind={kind}
        subject={t.subject}
        blocks={t.blocks}
        vars={t.meta.vars}
        sample={TEMPLATE_SAMPLE}
        logoUrl={t.logoUrl}
        customized={t.customized}
      />
    </>
  );
}
