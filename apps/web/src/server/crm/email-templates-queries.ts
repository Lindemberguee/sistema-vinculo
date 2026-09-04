import "server-only";
import {
  EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_KINDS,
  WIRED_TEMPLATE_KINDS,
  normalizeEmailBlocks,
  renderEmailBlocks,
  renderTemplate,
  type EmailBlock,
  type EmailTemplateKind,
  type TemplateMeta,
} from "@donation/emails";
import type { requireOrgAccess } from "@/server/auth-helpers";

type Db = Awaited<ReturnType<typeof requireOrgAccess>>["db"];

export interface TemplateListItem {
  meta: TemplateMeta;
  customized: boolean;
  enabled: boolean;
  wired: boolean;
}

export async function getEmailTemplateList(db: Db, organizationId: string): Promise<TemplateListItem[]> {
  const rows = await db.emailTemplate.findMany({
    where: { organizationId, locale: "pt-BR" },
    select: { kind: true, enabled: true },
  });
  const byKind = new Map(rows.map((r) => [r.kind, r]));
  return EMAIL_TEMPLATE_KINDS.map((kind) => {
    const meta = EMAIL_TEMPLATES[kind];
    const row = byKind.get(kind);
    return {
      meta,
      customized: Boolean(row),
      enabled: meta.optIn ? Boolean(row?.enabled) : true,
      wired: WIRED_TEMPLATE_KINDS.has(kind),
    };
  });
}

export interface TemplateDetail {
  meta: TemplateMeta;
  subject: string;
  bodyHtml: string;
  /** Editable block list for the builder. */
  blocks: EmailBlock[];
  customized: boolean;
  enabled: boolean;
  wired: boolean;
  logoUrl: string | null;
  /** Rendered HTML with sample values, for the live preview. */
  previewHtml: string;
}

export const TEMPLATE_SAMPLE: Record<string, string> = {
  NOME: "Maria",
  ORGANIZACAO: "Instituto Exemplo",
  VALOR: "R$ 50,00",
  TOTAL: "R$ 52,45",
  METODO: "Pix",
  DATA: new Date().toLocaleString("pt-BR"),
  CAMPANHA: "Histórias que Transformam",
  LINK: "#",
  GERENCIAR: "#",
  EVENTO: "Jantar Beneficente",
  LOCAL: "Espaço Cultural — Rua X, 100",
  NUMERO: "042",
  PROXIMA_COBRANCA: new Date(Date.now() + 3 * 86_400_000).toLocaleDateString("pt-BR"),
  PREMIO: "Cesta artesanal",
  LOTE: "Quadro nº 3",
  LANCE: "R$ 320,00",
  CODIGO: "34191.79001 01043.510047 91020.150008 8 91230000052450",
  ANO: String(new Date().getFullYear() - 1),
  QTD: "7",
  QR:
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#eee"/><text x="100" y="105" font-size="16" text-anchor="middle" fill="#999">QR Pix</text></svg>',
    ),
};

export async function getEmailTemplate(
  db: Db,
  organizationId: string,
  kind: EmailTemplateKind,
): Promise<TemplateDetail | null> {
  const meta = EMAIL_TEMPLATES[kind];
  if (!meta) return null;

  const [row, cfg] = await Promise.all([
    db.emailTemplate.findUnique({
      where: { organizationId_kind_locale: { organizationId, kind, locale: "pt-BR" } },
      select: { subject: true, bodyHtml: true, blocksJson: true, enabled: true },
    }),
    db.organizationEmailConfig.findUnique({
      where: { organizationId },
      select: { logoUrl: true },
    }),
  ]);

  const subject = row?.subject ?? meta.subjectDefault;

  // Blocks: the stored list, or a legacy HTML override wrapped as one block, or the default.
  let blocks: EmailBlock[];
  if (row?.blocksJson != null) {
    blocks = normalizeEmailBlocks(row.blocksJson);
  } else if (row?.bodyHtml) {
    blocks = normalizeEmailBlocks([{ type: "html", props: { html: row.bodyHtml } }]);
  } else {
    blocks = meta.blocksDefault;
  }
  if (blocks.length === 0) blocks = meta.blocksDefault;

  const bodyHtml = row?.blocksJson != null ? renderEmailBlocks(blocks) : (row?.bodyHtml ?? meta.bodyHtmlDefault);
  const preview = renderTemplate({
    subject,
    bodyHtml,
    vars: TEMPLATE_SAMPLE,
    logoUrl: cfg?.logoUrl ?? null,
    orgName: TEMPLATE_SAMPLE.ORGANIZACAO!,
  });

  return {
    meta,
    subject,
    bodyHtml,
    blocks,
    customized: Boolean(row),
    enabled: meta.optIn ? Boolean(row?.enabled) : true,
    wired: WIRED_TEMPLATE_KINDS.has(kind),
    logoUrl: cfg?.logoUrl ?? null,
    previewHtml: preview.html,
  };
}
