import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@donation/db";
import { formatBRL } from "@donation/shared";
import { resolveTenant } from "@/server/tenant";
import { PublicShell } from "@/components/public/PublicShell";
import { CopyButton } from "@/components/public/CopyButton";
import { Alert } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AuctionPayPage({
  params,
}: {
  params: Promise<{ host: string; donationId: string }>;
}) {
  const { host, donationId } = await params;
  const tenant = await resolveTenant(decodeURIComponent(host));
  if (!tenant || tenant.kind !== "site") notFound();

  const [org, donation, lot] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: tenant.organizationId },
      select: { displayName: true, branding: true },
    }),
    prisma.donation.findFirst({
      where: { id: donationId, organizationId: tenant.organizationId },
      select: { status: true, amountCents: true, paymentDetails: true },
    }),
    prisma.lot.findFirst({
      where: { donationId },
      select: { title: true, auction: { select: { title: true } } },
    }),
  ]);
  if (!org || !donation || !lot) notFound();

  const branding = (org.branding ?? {}) as { logoUrl?: string; primaryColor?: string };
  const pd = (donation.paymentDetails ?? {}) as { qrCode?: string; qrCodeUrl?: string };
  const qr = pd.qrCode ? await QRCode.toDataURL(pd.qrCode, { width: 240, margin: 1 }) : pd.qrCodeUrl;
  const paid = donation.status === "PAID";

  return (
    <PublicShell
      org={{ displayName: org.displayName, logoUrl: branding.logoUrl, accent: branding.primaryColor }}
      width="sm"
    >
      <p className="eyebrow">Lote arrematado</p>
      <h1 className="mt-1 text-xl font-semibold tracking-tight">{lot.title}</h1>
      <p className="mt-1 text-sm text-muted">{lot.auction.title}</p>

      {paid ? (
        <div className="mt-6">
          <Alert tone="success">
            Pagamento confirmado! {org.displayName} vai combinar a entrega com você.
          </Alert>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-5 text-center">
          <div className="eyebrow">Valor a pagar</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{formatBRL(donation.amountCents)}</div>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR Code Pix" width={220} height={220} className="mx-auto mt-4 rounded-lg" />
          )}
          {pd.qrCode && (
            <div className="mt-4">
              <div className="flex justify-center">
                <CopyButton text={pd.qrCode} label="Copiar Pix copia e cola" />
              </div>
              <code className="mt-2 block break-all rounded-md bg-canvas p-2 text-left text-2xs text-muted">
                {pd.qrCode}
              </code>
            </div>
          )}
          <p className="mt-4 text-xs text-muted">Esta página atualiza sozinha após a confirmação do pagamento.</p>
        </div>
      )}
    </PublicShell>
  );
}
