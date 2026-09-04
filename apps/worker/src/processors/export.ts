import { prisma } from "@donation/db";
import { putObject } from "../storage";

/** RFC-4180-ish CSV cell escaping. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const row = (cells: unknown[]) => cells.map(cell).join(",");

interface ExportFilters {
  from?: string;
  to?: string;
  campaignId?: string;
  method?: string;
  status?: string;
  recurring?: boolean;
}

export async function processExport(exportId: string): Promise<void> {
  const job = await prisma.export.findUnique({ where: { id: exportId } });
  if (!job || job.status === "DONE") return;

  await prisma.export.update({ where: { id: exportId }, data: { status: "PROCESSING" } });

  try {
    const f = (job.filters ?? {}) as ExportFilters;
    const csv = job.kind === "donations" ? await donationsCsv(job.organizationId, f) : await donorsCsv(job.organizationId, f);

    const key = `exports/${job.organizationId}/${job.kind}-${job.id}.csv`;
    await putObject(key, "﻿" + csv.body, "text/csv; charset=utf-8");

    await prisma.export.update({
      where: { id: exportId },
      data: { status: "DONE", storageKey: key, rowCount: csv.rows, completedAt: new Date(), error: null },
    });
  } catch (err) {
    await prisma.export.update({
      where: { id: exportId },
      data: { status: "FAILED", error: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }
}

async function donorsCsv(organizationId: string, f: ExportFilters) {
  const donors = await prisma.donor.findMany({
    where: {
      organizationId,
      ...(f.from || f.to
        ? { lastDonationAt: { gte: f.from ? new Date(f.from) : undefined, lte: f.to ? new Date(f.to) : undefined } }
        : {}),
    },
    orderBy: { totalDonatedCents: "desc" },
    select: {
      name: true,
      email: true,
      phone: true,
      totalDonatedCents: true,
      donationsCount: true,
      firstDonationAt: true,
      lastDonationAt: true,
      rfmSegment: true,
      tags: { select: { tag: true } },
    },
  });

  const header = row(["nome", "email", "telefone", "total_reais", "doacoes", "primeira", "ultima", "segmento_rfm", "tags"]);
  const lines = donors.map((d) =>
    row([
      d.name,
      d.email,
      d.phone,
      (d.totalDonatedCents / 100).toFixed(2),
      d.donationsCount,
      d.firstDonationAt,
      d.lastDonationAt,
      d.rfmSegment,
      d.tags.map((t) => t.tag).join("|"),
    ]),
  );
  return { body: [header, ...lines].join("\n"), rows: donors.length };
}

async function donationsCsv(organizationId: string, f: ExportFilters) {
  const donations = await prisma.donation.findMany({
    where: {
      organizationId,
      ...(f.campaignId ? { campaignId: f.campaignId } : {}),
      ...(f.method ? { method: f.method as never } : {}),
      ...(f.status ? { status: f.status as never } : {}),
      ...(f.recurring === true ? { recurringPlanId: { not: null } } : {}),
      ...(f.from || f.to
        ? { createdAt: { gte: f.from ? new Date(f.from) : undefined, lte: f.to ? new Date(f.to) : undefined } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      paidAt: true,
      method: true,
      status: true,
      amountCents: true,
      tipCents: true,
      platformFeeCents: true,
      netToOrgCents: true,
      recurringPlanId: true,
      donor: { select: { name: true, email: true } },
      campaign: { select: { title: true } },
    },
  });

  const header = row([
    "criada_em",
    "paga_em",
    "doador",
    "email",
    "campanha",
    "metodo",
    "status",
    "recorrente",
    "valor_reais",
    "gorjeta_reais",
    "taxa_plataforma_reais",
    "liquido_ong_reais",
  ]);
  const lines = donations.map((d) =>
    row([
      d.createdAt,
      d.paidAt,
      d.donor.name,
      d.donor.email,
      d.campaign?.title ?? "",
      d.method,
      d.status,
      d.recurringPlanId ? "sim" : "nao",
      (d.amountCents / 100).toFixed(2),
      (d.tipCents / 100).toFixed(2),
      (d.platformFeeCents / 100).toFixed(2),
      (d.netToOrgCents / 100).toFixed(2),
    ]),
  );
  return { body: [header, ...lines].join("\n"), rows: donations.length };
}
