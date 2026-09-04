import {
  EMAIL_TEMPLATES,
  renderTemplate,
  type EmailTemplateKind,
  type RenderedEmail,
} from "@donation/emails";
import { prisma } from "./index";

/**
 * Resolve an org's e-mail for `kind` — its override if it has one, else the
 * platform default — filled with `vars` and wrapped in the shell with the org
 * logo. Used by the worker and web send paths.
 */
export async function renderOrgEmail(
  organizationId: string,
  kind: EmailTemplateKind,
  vars: Record<string, string | undefined>,
  locale = "pt-BR",
): Promise<RenderedEmail> {
  const [org, tpl] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { displayName: true, emailConfig: { select: { logoUrl: true } } },
    }),
    prisma.emailTemplate.findUnique({
      where: { organizationId_kind_locale: { organizationId, kind, locale } },
      select: { subject: true, bodyHtml: true, enabled: true },
    }),
  ]);

  const def = EMAIL_TEMPLATES[kind];
  return renderTemplate({
    subject: tpl?.subject ?? def.subjectDefault,
    bodyHtml: tpl?.bodyHtml ?? def.bodyHtmlDefault,
    vars,
    logoUrl: org?.emailConfig?.logoUrl ?? null,
    orgName: org?.displayName ?? "",
  });
}

/** Whether an opt-in relationship recipe is turned on for the org. */
export async function isEmailTemplateEnabled(
  organizationId: string,
  kind: EmailTemplateKind,
  locale = "pt-BR",
): Promise<boolean> {
  if (!EMAIL_TEMPLATES[kind].optIn) return true;
  const tpl = await prisma.emailTemplate.findUnique({
    where: { organizationId_kind_locale: { organizationId, kind, locale } },
    select: { enabled: true },
  });
  return Boolean(tpl?.enabled);
}
