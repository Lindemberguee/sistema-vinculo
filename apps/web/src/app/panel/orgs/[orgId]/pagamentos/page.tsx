import { headers } from "next/headers";
import { requireOrgAccessPage } from "@/server/auth-helpers";
import { isPaymentsCryptoReady } from "@/server/crypto";
import { env } from "@/env";
import { PageHeader, Alert } from "@/components/ui";
import { ConnectGatewayForm } from "@/components/payments/ConnectGatewayForm";
import { TestConnectionButton } from "@/components/payments/TestConnectionButton";
import { WebhookSettings } from "@/components/payments/WebhookSettings";

const PROVIDER_LABEL: Record<string, string> = {
  PAGARME: "Pagar.me",
  MERCADOPAGO: "Mercado Pago",
  ASAAS: "Asaas",
  STRIPE: "Stripe",
};

export default async function PaymentsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db } = await requireOrgAccessPage(orgId, "ADMIN");

  const cfg = await db.organizationPaymentConfig.findFirst({
    where: { organizationId: orgId },
    select: { provider: true, mode: true, publicKey: true, webhookSecret: true, verifiedAt: true, updatedAt: true },
  });

  // Prefer the explicitly configured public origin (tunnel / real domain).
  // Otherwise build it from the host the admin is actually on.
  const h = await headers();
  const reqHost = h.get("host") ?? "";
  const envBase = env.APP_BASE_DOMAIN;
  const host = reqHost || (envBase.startsWith("app.") ? envBase : `app.${envBase}`);
  const scheme = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = env.PUBLIC_WEBHOOK_BASE_URL?.replace(/\/$/, "") ?? `${scheme}://${host}`;
  const webhookUrl = cfg ? `${origin}/api/webhooks/${cfg.provider.toLowerCase()}/${orgId}` : "";
  const [webhookUser, webhookPassword] = (cfg?.webhookSecret ?? "hook:").split(/:(.*)/s);
  const localHost = /^https?:\/\/(localhost|127\.0\.0\.1|[^/]*\.localhost)/.test(origin);

  return (
    <>
      <PageHeader
        title="Pagamentos"
        description="Conecte a conta do seu provedor de pagamento. As doações caem direto nela — a plataforma não fica no meio do dinheiro."
        back={{ href: `/orgs/${orgId}`, label: "Painel" }}
      />

      {!isPaymentsCryptoReady() && (
        <Alert tone="danger">
          O servidor ainda não está configurado para guardar chaves com segurança (<code>PAYMENTS_ENC_KEY</code>). Conexão
          indisponível até isso ser resolvido.
        </Alert>
      )}

      {cfg?.verifiedAt ? (
        <div className="mt-4 space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{PROVIDER_LABEL[cfg.provider] ?? cfg.provider} conectado</div>
                <div className="mt-0.5 text-xs text-muted">
                  Modo {cfg.mode === "MANAGED" ? "gerenciado (com split)" : "conectado (conta própria)"} · atualizado em{" "}
                  {cfg.updatedAt.toLocaleString("pt-BR")}
                </div>
              </div>
              <span className="badge-success">Ativo</span>
            </div>
            <dl className="mt-4 grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Chave pública</dt>
                <dd className="truncate font-mono text-xs">{cfg.publicKey}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Última verificação</dt>
                <dd className="text-xs">{cfg.verifiedAt.toLocaleString("pt-BR")}</dd>
              </div>
            </dl>
            <div className="mt-4 border-t border-line pt-4">
              <TestConnectionButton orgId={orgId} />
            </div>
          </div>

          <WebhookSettings
            orgId={orgId}
            providerLabel={PROVIDER_LABEL[cfg.provider] ?? cfg.provider}
            url={webhookUrl}
            user={webhookUser ?? "hook"}
            password={webhookPassword ?? ""}
            hostNote={localHost}
          />

          <ConnectGatewayForm orgId={orgId} currentProvider={cfg.provider} reconnect />
        </div>
      ) : (
        <div className="mt-4">
          <ConnectGatewayForm orgId={orgId} currentProvider={cfg?.provider ?? null} reconnect={false} />
        </div>
      )}
    </>
  );
}
