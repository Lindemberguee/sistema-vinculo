import { requireOrgAccessPage } from "@/server/auth-helpers";
import { SMART_LISTS, SMART_LIST_KEYS } from "@/server/crm/queries";
import { getBroadcastPreview } from "@/server/crm/broadcasts-queries";
import { BroadcastComposer, type SegmentOption } from "@/components/crm/BroadcastComposer";
import { PageHeader } from "@/components/ui";

const FILTER_KEYS = ["q", "segment", "campaignId", "tag", "recurring", "minReais", "owner", "task", "smart", "view"];

export default async function NewBroadcastPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  const { db } = await requireOrgAccessPage(orgId, "ADMIN");

  const filters: Record<string, string> = {};
  for (const k of FILTER_KEYS) {
    const v = Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined);
    if (v) filters[k] = v;
  }
  const hasFilters = Object.keys(filters).length > 0;

  const [segments, preview] = await Promise.all([
    db.donorSegment.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, filters: true },
    }),
    hasFilters ? getBroadcastPreview(db, orgId, filters) : Promise.resolve(null),
  ]);

  const segmentOptions: SegmentOption[] = [
    ...SMART_LIST_KEYS.map((k) => ({ id: `smart:${k}`, label: SMART_LISTS[k].label, params: { smart: k } })),
    ...segments.map((s) => ({
      id: `seg:${s.id}`,
      label: s.name,
      params: (s.filters ?? {}) as Record<string, string>,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Nova mensagem"
        description="E-mail único para todos os doadores de um segmento."
        back={{ href: `/orgs/${orgId}/broadcasts`, label: "Comunicação" }}
      />
      <BroadcastComposer
        orgId={orgId}
        filters={filters}
        hasFilters={hasFilters}
        segmentOptions={segmentOptions}
        preview={preview}
      />
    </>
  );
}
