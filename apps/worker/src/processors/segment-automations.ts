import {
  buildDonorWhere,
  parseDonorFilters,
  prisma,
  renderOrgEmail,
  resolveOrgSender,
  signUnsubscribe,
} from "@donation/db";
import { sendEmail, type EmailTemplateKind } from "@donation/emails";
import { appOrigin, orgOrigin } from "../urls";

const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;
const MATCH_CAP = 20_000;

/**
 * "Régua por segmento": for each enabled SegmentAutomation, reconcile the
 * segment's membership snapshot, then e-mail the chosen template to donors who
 * entered the segment >= delayDays ago (and after the rule was created).
 * Deduped per (donor, rule) via EmailLog `segment-automation:<id>`.
 */
export async function runSegmentAutomations(): Promise<{ segments: number; sent: number }> {
  const rules = await prisma.segmentAutomation.findMany({
    where: { enabled: true },
    select: {
      id: true,
      organizationId: true,
      segmentId: true,
      templateKind: true,
      delayDays: true,
      createdAt: true,
      segment: { select: { filters: true } },
    },
  });
  if (rules.length === 0) return { segments: 0, sent: 0 };

  // ── 1. Reconcile membership once per distinct segment ──────────────
  const bySegment = new Map<string, { organizationId: string; filters: unknown }>();
  for (const r of rules) bySegment.set(r.segmentId, { organizationId: r.organizationId, filters: r.segment.filters });

  for (const [segmentId, { organizationId, filters }] of bySegment) {
    const where = buildDonorWhere(
      organizationId,
      parseDonorFilters((filters ?? {}) as Record<string, string>),
    );
    const matches = await prisma.donor.findMany({ where, take: MATCH_CAP, select: { id: true } });
    const matchIds = new Set(matches.map((m) => m.id));

    // The baseline (members present when a rule was created) is seeded at
    // `enteredAt = epoch` by `createSegmentAutomation`, so they never trigger.
    // Here we just diff: newcomers get `enteredAt = now`, leavers are removed.
    const existing = await prisma.segmentMembership.findMany({
      where: { segmentId },
      select: { donorId: true },
    });
    const existingIds = new Set(existing.map((e) => e.donorId));
    const entered = [...matchIds].filter((id) => !existingIds.has(id));
    const left = [...existingIds].filter((id) => !matchIds.has(id));

    if (entered.length > 0) {
      await prisma.segmentMembership.createMany({
        data: entered.map((donorId) => ({ segmentId, donorId })),
        skipDuplicates: true,
      });
    }
    if (left.length > 0) {
      await prisma.segmentMembership.deleteMany({ where: { segmentId, donorId: { in: left } } });
    }
  }

  // ── 2. Fire each rule ─────────────────────────────────────────────
  const now = Date.now();
  let sent = 0;

  // Per-org context, resolved lazily.
  const ctxCache = new Map<
    string,
    { from: string; replyTo?: string; orgName: string; orgSlug: string; suppressed: Set<string> }
  >();
  async function ctxFor(orgId: string) {
    let c = ctxCache.get(orgId);
    if (c) return c;
    const [sender, org, sup] = await Promise.all([
      resolveOrgSender(orgId),
      prisma.organization.findUnique({ where: { id: orgId }, select: { displayName: true, slug: true } }),
      prisma.donorEmailStatus.findMany({ where: { organizationId: orgId }, select: { email: true } }),
    ]);
    c = {
      from: sender.from,
      replyTo: sender.replyTo,
      orgName: org?.displayName ?? "",
      orgSlug: org?.slug ?? "",
      suppressed: new Set(sup.map((r) => r.email.toLowerCase())),
    };
    ctxCache.set(orgId, c);
    return c;
  }

  for (const rule of rules) {
    const cutoff = new Date(now - rule.delayDays * 86_400_000);
    const due = await prisma.segmentMembership.findMany({
      where: { segmentId: rule.segmentId, enteredAt: { gte: rule.createdAt, lte: cutoff } },
      select: { donorId: true },
      take: 5000,
    });
    if (due.length === 0) continue;

    const ctx = await ctxFor(rule.organizationId);
    const dedupKind = `segment-automation:${rule.id}`;
    const link = orgOrigin(ctx.orgSlug);
    let ruleSent = 0;

    for (const { donorId } of due) {
      const donor = await prisma.donor.findUnique({
        where: { id: donorId },
        select: { name: true, email: true, consent: true },
      });
      if (!donor) continue;
      if ((donor.consent as { email?: boolean } | null)?.email === false) continue;
      if (ctx.suppressed.has(donor.email.toLowerCase())) continue;

      try {
        await prisma.emailLog.create({
          data: { organizationId: rule.organizationId, donorId, kind: dedupKind },
        });
      } catch {
        continue; // already sent to this donor for this rule
      }

      const email = await renderOrgEmail(rule.organizationId, rule.templateKind as EmailTemplateKind, {
        NOME: firstName(donor.name),
        ORGANIZACAO: ctx.orgName,
        LINK: link,
      });
      const unsubUrl = `${appOrigin()}/api/u/${signUnsubscribe(rule.organizationId, donorId)}`;
      try {
        await sendEmail(donor.email, email, {
          from: ctx.from,
          replyTo: ctx.replyTo,
          headers: {
            "List-Unsubscribe": `<${unsubUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        sent++;
        ruleSent++;
      } catch (e) {
        console.error(`segment-automation ${rule.id} → ${donor.email}:`, e instanceof Error ? e.message : e);
      }
    }

    if (ruleSent > 0) {
      await prisma.segmentAutomation.update({
        where: { id: rule.id },
        data: { sentCount: { increment: ruleSent } },
      });
    }
  }

  return { segments: bySegment.size, sent };
}
