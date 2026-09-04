import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@donation/db";
import { resolveTenant } from "@/server/tenant";
import { PublicShell } from "@/components/public/PublicShell";
import { PrintButton } from "@/components/public/CopyButton";
import { StatusBadge, Alert } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TicketOrderPage({
  params,
}: {
  params: Promise<{ host: string; donationId: string }>;
}) {
  const { host, donationId } = await params;
  const tenant = await resolveTenant(decodeURIComponent(host));
  if (!tenant || tenant.kind !== "site") notFound();

  const [org, donation, tickets] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: tenant.organizationId },
      select: { displayName: true, branding: true },
    }),
    prisma.donation.findFirst({
      where: { id: donationId, organizationId: tenant.organizationId },
      select: { status: true },
    }),
    prisma.eventTicket.findMany({
      where: { donationId },
      orderBy: { createdAt: "asc" },
      select: {
        code: true,
        status: true,
        attendeeName: true,
        checkedInAt: true,
        ticketType: { select: { name: true } },
        event: { select: { title: true, venue: true, startsAt: true } },
      },
    }),
  ]);
  if (!org || !donation || tickets.length === 0) notFound();

  const branding = (org.branding ?? {}) as { logoUrl?: string; primaryColor?: string };
  const ev = tickets[0]!.event;
  const paid = donation.status === "PAID";
  const withQr = await Promise.all(
    tickets.map(async (t) => ({ ...t, qr: await QRCode.toDataURL(t.code, { width: 240, margin: 1 }) })),
  );

  return (
    <PublicShell
      org={{ displayName: org.displayName, logoUrl: branding.logoUrl, accent: branding.primaryColor }}
      width="lg"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">
            {tickets.length} {tickets.length === 1 ? "ingresso" : "ingressos"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{ev.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {ev.venue} · {ev.startsAt.toLocaleString("pt-BR")}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="mt-4">
        {paid ? (
          <Alert tone="success">
            Pagamento confirmado. Apresente o QR Code de cada ingresso na entrada do evento.
          </Alert>
        ) : (
          <Alert tone="warn">
            Pagamento ainda não confirmado — os ingressos só valem para entrada após a confirmação. Esta página
            atualiza sozinha.
          </Alert>
        )}
      </div>

      <div className="mt-6 grid gap-3">
        {withQr.map((t, i) => (
          <div key={t.code} className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={t.qr}
              alt={`QR Code do ingresso ${i + 1}`}
              width={120}
              height={120}
              className="shrink-0 rounded-lg"
            />
            <div className="min-w-0 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  Ingresso {i + 1} — {t.ticketType.name}
                </span>
                <StatusBadge status={t.status} />
              </div>
              {t.attendeeName && <div className="text-muted">{t.attendeeName}</div>}
              <div className="mt-1 font-mono text-xs text-faint">{t.code}</div>
              {t.status === "USED" && t.checkedInAt && (
                <div className="mt-1 text-xs text-muted">
                  Utilizado em {t.checkedInAt.toLocaleString("pt-BR")}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </PublicShell>
  );
}
