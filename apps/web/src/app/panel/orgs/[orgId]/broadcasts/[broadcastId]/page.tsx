import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import {
  getBroadcastDetail,
  getBroadcastRecipients,
  type RecipientStatus,
} from "@/server/crm/broadcasts-queries";
import { BroadcastDetailActions } from "@/components/crm/BroadcastDetailActions";
import { ContactLinks } from "@/components/crm/ContactLinks";
import {
  PageHeader,
  Card,
  CardBody,
  Table,
  Th,
  Td,
  Tr,
  Badge,
  Alert,
  LinkButton,
  cn,
} from "@/components/ui";

const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const STATUS_LABEL: Record<string, { label: string; tone: "neutral" | "success" | "warn" | "danger" }> = {
  DRAFT: { label: "Rascunho", tone: "neutral" },
  SCHEDULED: { label: "Agendada", tone: "warn" },
  SENDING: { label: "Enviando", tone: "warn" },
  SENT: { label: "Enviada", tone: "success" },
  FAILED: { label: "Falhou", tone: "danger" },
};

const RECIP_LABEL: Record<RecipientStatus, { label: string; tone: "neutral" | "success" | "warn" | "danger" }> = {
  QUEUED: { label: "Na fila", tone: "neutral" },
  SENT: { label: "Entregue", tone: "success" },
  SKIPPED_SUPPRESSED: { label: "Pulado (suprimido)", tone: "warn" },
  SKIPPED_DUPLICATE: { label: "Pulado (duplicado)", tone: "neutral" },
  FAILED: { label: "Falhou", tone: "danger" },
};

const HEALTH_LABEL: Record<string, { label: string; tone: "warn" | "danger" }> = {
  BOUNCED: { label: "Bounce", tone: "danger" },
  COMPLAINED: { label: "Reclamação", tone: "danger" },
  UNSUBSCRIBED: { label: "Descadastro", tone: "warn" },
};

const RECIP_FILTERS: { key: string; label: string; status?: RecipientStatus }[] = [
  { key: "", label: "Todos" },
  { key: "SENT", label: "Entregues", status: "SENT" },
  { key: "SKIPPED_SUPPRESSED", label: "Pulados", status: "SKIPPED_SUPPRESSED" },
  { key: "FAILED", label: "Falhas", status: "FAILED" },
];

export default async function BroadcastDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; broadcastId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId, broadcastId } = await params;
  const sp = await searchParams;
  const { db } = await requireOrgAccessPage(orgId, "ADMIN");

  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { displayName: true } });
  const b = await getBroadcastDetail(db, orgId, broadcastId, org.displayName);
  if (!b) notFound();

  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  const rstatusRaw = one("rstatus");
  const rstatus = (RECIP_FILTERS.find((f) => f.key === rstatusRaw)?.status) as RecipientStatus | undefined;
  const rq = one("rq")?.trim() || undefined;
  const rpage = Math.max(1, Number(one("rpage")) || 1);

  const recips = await getBroadcastRecipients(db, orgId, broadcastId, { status: rstatus, q: rq, page: rpage });

  const s = STATUS_LABEL[b.status] ?? { label: b.status, tone: "neutral" as const };
  const failed = (b.recipientStats.FAILED ?? 0) + 0;
  const skipped =
    (b.recipientStats.SKIPPED_SUPPRESSED ?? 0) + (b.recipientStats.SKIPPED_DUPLICATE ?? 0);

  const donorsHref = `/orgs/${orgId}/donors?${new URLSearchParams(b.filters).toString()}`;
  const buildQs = (over: { rstatus?: string | null; rq?: string | null; rpage?: string | null }) => {
    const p = new URLSearchParams();
    const rs = over.rstatus === undefined ? rstatusRaw : over.rstatus;
    const q = over.rq === undefined ? rq : over.rq;
    if (rs) p.set("rstatus", rs);
    if (q) p.set("rq", q);
    if (over.rpage) p.set("rpage", over.rpage);
    const str = p.toString();
    return str ? `?${str}` : "?";
  };

  return (
    <>
      <PageHeader
        title={b.name || b.subject}
        description={b.name ? b.subject : undefined}
        back={{ href: `/orgs/${orgId}/broadcasts`, label: "Comunicação" }}
        actions={
          <BroadcastDetailActions
            orgId={orgId}
            broadcastId={b.id}
            status={b.status}
            recipientCount={b.recipientCount}
          />
        }
      />

      {b.status === "FAILED" && b.error && (
        <div className="mb-4">
          <Alert tone="danger">Falha no envio: {b.error}</Alert>
        </div>
      )}

      <div className="mb-4 card p-5">
        <dl className="flex flex-wrap gap-y-3 [&>*+*]:ml-8 [&>*+*]:border-l [&>*+*]:border-line [&>*+*]:pl-8">
          <div>
            <dt className="eyebrow">Situação</dt>
            <dd className="mt-0.5">
              <Badge tone={s.tone}>{s.label}</Badge>
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Destinatários</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{b.recipientCount}</dd>
          </div>
          <div>
            <dt className="eyebrow">Enviados</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{b.sentCount}</dd>
          </div>
          <div>
            <dt className="eyebrow">Pulados</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{skipped || b.skippedCount}</dd>
          </div>
          <div>
            <dt className="eyebrow">Falhas</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{failed}</dd>
          </div>
          <div>
            <dt className="eyebrow">{b.status === "SCHEDULED" ? "Agendada para" : "Data"}</dt>
            <dd className="mt-0.5 text-sm">
              {b.status === "SCHEDULED" && b.scheduledAt
                ? dt.format(b.scheduledAt)
                : (b.sentAt ?? b.createdAt).toLocaleDateString("pt-BR")}
              {b.createdBy ? <span className="text-muted"> · por {b.createdBy}</span> : null}
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold">Audiência</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {b.audience.map((a) => (
                <span
                  key={a.label}
                  className="rounded-md border border-line-strong px-2 py-0.5 text-xs text-muted"
                >
                  {a.label}
                </span>
              ))}
              {b.campaignTitle && (
                <span className="rounded-md border border-line-strong px-2 py-0.5 text-xs text-muted">
                  Campanha: {b.campaignTitle}
                </span>
              )}
            </div>
            <div className="mt-3">
              <LinkButton href={donorsHref} variant="secondary" size="sm">
                Ver doadores desse filtro
              </LinkButton>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold">Mensagem</h2>
            <p className="mt-1 text-sm text-muted">
              <span className="font-medium text-ink">Assunto:</span> {b.subject}
            </p>
            <details className="group mt-2">
              <summary className="cursor-pointer text-sm font-medium text-brand-600">Ver prévia</summary>
              <iframe
                title="Prévia da mensagem"
                srcDoc={b.previewHtml}
                className="mt-2 h-[26rem] w-full rounded-lg border border-line bg-white"
              />
            </details>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardBody className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <h2 className="text-sm font-semibold">Destinatários</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {RECIP_FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={buildQs({ rstatus: f.key || null, rpage: null })}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium",
                    (rstatusRaw ?? "") === f.key
                      ? "bg-brand-600 text-white"
                      : "border border-line-strong text-muted hover:text-ink",
                  )}
                >
                  {f.label}
                </Link>
              ))}
            </div>
            <form className="flex gap-1">
              {rstatusRaw && <input type="hidden" name="rstatus" value={rstatusRaw} />}
              <input
                name="rq"
                defaultValue={rq ?? ""}
                placeholder="Buscar e-mail…"
                className="input h-8 w-40 text-sm"
              />
            </form>
          </div>
        </CardBody>
        <Table>
          <thead>
            <Tr>
              <Th>Nome</Th>
              <Th>Contato</Th>
              <Th>Enviado em</Th>
              <Th>Situação</Th>
            </Tr>
          </thead>
          <tbody>
            {recips.rows.map((r) => {
              const rl = RECIP_LABEL[r.status];
              const hl = r.emailHealth ? HEALTH_LABEL[r.emailHealth] : null;
              return (
                <Tr key={r.donorId}>
                  <Td>
                    <Link
                      href={`/orgs/${orgId}/donors/${r.donorId}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {r.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {r.rfmSegment ?? "—"}
                      {r.lastDonationAt ? ` · última ${r.lastDonationAt.toLocaleDateString("pt-BR")}` : ""}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">{r.email}</span>
                      <ContactLinks email={r.email} phone={r.phone} />
                    </div>
                  </Td>
                  <Td className="text-sm">{r.sentAt ? dt.format(r.sentAt) : "—"}</Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span title={r.error ?? undefined}>
                        <Badge tone={rl.tone}>{rl.label}</Badge>
                      </span>
                      {hl && <Badge tone={hl.tone}>{hl.label}</Badge>}
                    </div>
                  </Td>
                </Tr>
              );
            })}
            {recips.rows.length === 0 && (
              <Tr>
                <Td colSpan={4} className="text-muted">
                  {b.status === "SENT" || b.status === "SENDING"
                    ? "Nenhum destinatário para este filtro."
                    : "Os destinatários aparecem aqui depois do envio."}
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
        {recips.pages > 1 && (
          <CardBody className="flex items-center justify-between pt-3 text-sm">
            <span className="text-muted">
              Página {recips.page} de {recips.pages} · {recips.total} no total
            </span>
            <div className="flex gap-2">
              {recips.page > 1 && (
                <Link href={buildQs({ rpage: String(recips.page - 1) })} className="link">
                  Anterior
                </Link>
              )}
              {recips.page < recips.pages && (
                <Link href={buildQs({ rpage: String(recips.page + 1) })} className="link">
                  Próxima
                </Link>
              )}
            </div>
          </CardBody>
        )}
      </Card>
    </>
  );
}
