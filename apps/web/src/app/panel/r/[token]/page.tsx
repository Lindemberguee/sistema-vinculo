import { notFound } from "next/navigation";
import { prisma } from "@donation/db";
import { formatBRL } from "@donation/shared";
import { RecurringManage } from "@/components/RecurringManage";
import { Card, CardBody, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Public donor self-service page — reached only with the unguessable cancelToken. */
export default async function ManageRecurring({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const plan = await prisma.recurringPlan.findUnique({
    where: { cancelToken: token },
    select: {
      status: true,
      amountCents: true,
      tipCents: true,
      interval: true,
      nextChargeAt: true,
      method: true,
      organization: { select: { displayName: true } },
      campaign: { select: { title: true } },
      donations: {
        where: { status: "PENDING", method: "PIX" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { paymentDetails: true },
      },
    },
  });
  if (!plan) notFound();

  const pendingPix = plan.donations[0]?.paymentDetails as { qrCode?: string; qrCodeUrl?: string } | undefined;

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-xl font-semibold">Sua doação recorrente</h1>
      <p className="mt-1 text-sm text-muted">
        Para <strong>{plan.organization.displayName}</strong>
        {plan.campaign ? ` — ${plan.campaign.title}` : ""}
      </p>

      <Card className="mt-4">
        <CardBody>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">Valor</dt>
            <dd>
              {formatBRL(plan.amountCents + plan.tipCents)} / {plan.interval === "YEARLY" ? "ano" : "mês"} (
              {plan.method === "PIX" ? "Pix" : "Cartão"})
            </dd>
            <dt className="text-muted">Status</dt>
            <dd>
              <StatusBadge status={plan.status} />
            </dd>
            <dt className="text-muted">Próxima cobrança</dt>
            <dd>{plan.nextChargeAt.toLocaleDateString("pt-BR")}</dd>
          </dl>

          {plan.status !== "CANCELED" && pendingPix?.qrCodeUrl && (
            <div className="mt-5 text-center">
              <p className="text-sm text-muted">Pagamento deste mês pendente:</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingPix.qrCodeUrl} alt="QR Code Pix" width={200} height={200} className="mx-auto" />
              {pendingPix.qrCode && (
                <code className="mt-2 block break-all rounded-md bg-canvas p-2 text-xs">{pendingPix.qrCode}</code>
              )}
            </div>
          )}

          <RecurringManage token={token} canceled={plan.status === "CANCELED"} />
        </CardBody>
      </Card>
    </main>
  );
}
