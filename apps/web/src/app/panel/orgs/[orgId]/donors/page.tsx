import Link from "next/link";
import { formatBRL } from "@donation/shared";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import {
  DONORS_PAGE_SIZE,
  DONOR_FILTER_KEYS,
  SMART_LISTS,
  SMART_LIST_KEYS,
  buildDonorWhere,
  donorOrderBy,
  parseDonorFilters,
  getDonorSummary,
} from "@/server/crm/queries";
import { DonorResultsTable } from "@/components/crm/DonorResultsTable";
import { SegmentBar } from "@/components/crm/SegmentBar";
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Field,
  Input,
  Select,
  Checkbox,
  SummaryStrip,
  cn,
} from "@/components/ui";

const VIEWS = [
  { key: "", label: "Todos" },
  { key: "recurring", label: "Recorrentes" },
  { key: "oneoff", label: "Pontuais" },
  { key: "lead", label: "Leads" },
] as const;

export default async function DonorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  const { db } = await requireOrgAccessPage(orgId, "VIEWER");

  const f = parseDonorFilters(sp);
  const where = buildDonorWhere(orgId, f);

  const [summary, campaigns, members, segments, total, donors] = await Promise.all([
    getDonorSummary(orgId),
    db.campaign.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
    db.membership.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
      select: { userId: true, user: { select: { name: true } } },
    }),
    db.donorSegment.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, filters: true },
    }),
    db.donor.count({ where }),
    db.donor.findMany({
      where,
      orderBy: donorOrderBy(f.sort),
      skip: (f.page! - 1) * DONORS_PAGE_SIZE,
      take: DONORS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        totalDonatedCents: true,
        donationsCount: true,
        lastDonationAt: true,
        rfmSegment: true,
        owner: { select: { name: true } },
        tasks: { where: { doneAt: null }, select: { dueAt: true } },
      },
    }),
  ]);

  const now = Date.now();

  const pages = Math.max(1, Math.ceil(total / DONORS_PAGE_SIZE));
  const activeView = f.view ?? "";
  const hasFilters = DONOR_FILTER_KEYS.some((k) => flatten(sp)[k]);

  const qs = (patch: Record<string, string>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...flatten(sp), ...patch })) if (v) u.set(k, v);
    return `?${u.toString()}`;
  };

  const currentParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(flatten(sp))) if (k !== "page" && v) currentParams[k] = v;

  return (
    <>
      <PageHeader
        title="Doadores"
        actions={
          <Link href={`/orgs/${orgId}/exports`} className="link text-sm">
            Exportar CSV →
          </Link>
        }
      />

      <div className="space-y-4">
        <SummaryStrip
          stats={[
            { label: "Total de doadores", value: summary.total },
            { label: "Já doaram", value: summary.donated },
            { label: "Total doado", value: formatBRL(summary.totalDonatedCents) },
            { label: "Ticket médio", value: formatBRL(summary.avgTicketCents) },
            { label: "Recorrentes", value: `${Math.round(summary.recurringShare * 100)}%` },
          ]}
          segments={[
            { label: "Pontual", value: summary.composition.oneoff, color: "bg-brand-500" },
            { label: "Recorrente", value: summary.composition.recurring, color: "bg-accent-400" },
            { label: "Lead", value: summary.composition.lead, color: "bg-line-strong" },
          ]}
        />

        <Card>
          <CardBody className="space-y-4">
            <SegmentBar
              orgId={orgId}
              smartLists={SMART_LIST_KEYS.map((k) => ({ key: k, label: SMART_LISTS[k].label }))}
              activeSmart={f.smart}
              saved={segments.map((s) => ({
                id: s.id,
                name: s.name,
                filters: (s.filters ?? {}) as Record<string, string>,
              }))}
              currentParams={currentParams}
            />

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <span className="eyebrow mr-1">Visões</span>
              {VIEWS.map((v) => (
                <Link
                  key={v.key}
                  href={qs({ view: v.key, page: "" })}
                  aria-current={v.key === activeView ? "true" : undefined}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    v.key === activeView
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-line-strong text-muted hover:border-muted/40 hover:text-ink",
                  )}
                >
                  {v.label}
                </Link>
              ))}
            </div>

            <details className="group">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-brand-600">
                <span className="transition-transform group-open:rotate-90">›</span>
                Filtros avançados
              </summary>
              <form method="get" className="mt-3 grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {activeView && <input type="hidden" name="view" value={activeView} />}
                <Field label="Buscar">
                  <Input name="q" defaultValue={f.q ?? ""} placeholder="nome ou e-mail" />
                </Field>
                <Field label="Campanha">
                  <Select name="campaignId" defaultValue={f.campaignId ?? ""}>
                    <option value="">Todas</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Segmento RFM">
                  <Input name="segment" defaultValue={f.segment ?? ""} placeholder="ex.: Campeões" />
                </Field>
                <Field label="Tag">
                  <Input name="tag" defaultValue={f.tag ?? ""} />
                </Field>
                <Field label="Responsável">
                  <Select name="owner" defaultValue={f.ownerUserId ?? ""}>
                    <option value="">Qualquer</option>
                    <option value="none">Sem responsável</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Doou ≥ R$">
                  <Input
                    name="minReais"
                    defaultValue={f.minCents ? String(f.minCents / 100) : ""}
                    inputMode="decimal"
                  />
                </Field>
                <Field label="Ordenar">
                  <Select name="sort" defaultValue={f.sort}>
                    <option value="recent">Mais recentes</option>
                    <option value="value">Maior valor</option>
                    <option value="frequency">Mais doações</option>
                  </Select>
                </Field>
                <div className="flex flex-col gap-2 self-end">
                  <Checkbox name="recurring" value="1" defaultChecked={f.recurring} label="Só recorrentes" />
                  <Checkbox name="task" value="1" defaultChecked={f.hasOpenTask} label="Com tarefa aberta" />
                </div>
                <div className="flex gap-2 self-end">
                  <Button type="submit" size="sm">
                    Filtrar
                  </Button>
                  {hasFilters && (
                    <Link
                      href={qs({ q: "", segment: "", campaignId: "", tag: "", minReais: "", recurring: "", owner: "", task: "", smart: "", page: "" })}
                      className="btn-secondary btn-sm no-underline"
                    >
                      Limpar
                    </Link>
                  )}
                </div>
              </form>
            </details>

            <p className="text-xs text-muted">
              {total} {total === 1 ? "doador" : "doadores"} ·{" "}
              {hasFilters ? "filtros aplicados" : "nenhum filtro aplicado"}
            </p>
          </CardBody>
        </Card>

        <DonorResultsTable
          orgId={orgId}
          members={members.map((m) => ({ id: m.userId, name: m.user.name }))}
          rows={donors.map((d) => ({
            id: d.id,
            name: d.name,
            email: d.email,
            totalDonatedCents: d.totalDonatedCents,
            donationsCount: d.donationsCount,
            lastDonation: d.lastDonationAt ? d.lastDonationAt.toLocaleDateString("pt-BR") : "—",
            segment: d.rfmSegment ?? "—",
            ownerName: d.owner?.name ?? null,
            openTasks: d.tasks.length,
            overdue: d.tasks.some((t) => t.dueAt != null && t.dueAt.getTime() < now),
          }))}
        />

        {pages > 1 && (
          <div className="flex items-center gap-4 text-sm">
            {f.page! > 1 && (
              <Link className="link" href={qs({ page: String(f.page! - 1) })}>
                ← anterior
              </Link>
            )}
            <span className="text-muted">
              página {f.page} de {pages}
            </span>
            {f.page! < pages && (
              <Link className="link" href={qs({ page: String(f.page! + 1) })}>
                próxima →
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function flatten(sp: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) out[k] = val;
  }
  return out;
}
