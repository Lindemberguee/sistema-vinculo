import { PagarmeGateway } from "./gateways/pagarme";
import { MockGateway, isMockGateway } from "./gateways/mock";
import type { PaymentGateway } from "./types";

/** Providers a customer can connect their own account for (BYOG). */
export type ConnectProvider = "PAGARME" | "MERCADOPAGO" | "ASAAS" | "STRIPE";

export const CONNECTABLE_PROVIDERS: { value: ConnectProvider; label: string; ready: boolean }[] = [
  { value: "PAGARME", label: "Pagar.me", ready: true },
  { value: "MERCADOPAGO", label: "Mercado Pago", ready: false },
  { value: "ASAAS", label: "Asaas", ready: false },
  { value: "STRIPE", label: "Stripe", ready: false },
];

export interface GatewayConnection {
  provider: ConnectProvider;
  secretKey: string;
  publicKey: string;
  webhookSecret: string;
}

/** Build a live gateway client from a stored/connected config. */
export function gatewayFromConnection(conn: Pick<GatewayConnection, "provider" | "secretKey" | "webhookSecret">): PaymentGateway {
  if (isMockGateway()) return new MockGateway();
  switch (conn.provider) {
    case "PAGARME":
      return new PagarmeGateway({ secretKey: conn.secretKey, webhookSecret: conn.webhookSecret });
    default:
      throw new Error(`Provider not yet supported for connected mode: ${conn.provider}`);
  }
}

export interface ProbeResult {
  ok: boolean;
  /** e.g. account/company name, for the UI to confirm the right account was connected. */
  accountName?: string;
  error?: string;
}

export interface WebhookRegistrationProbe {
  /** We reached the provider and could read its webhook-delivery log. */
  ok: boolean;
  error?: string;
  /** Total delivery records the provider has for this account (recent page). */
  deliveries: number;
  /** Most recent delivery whose target URL matches ours, if any. */
  match?: {
    event: string;
    createdAt: string;
    /** HTTP status our endpoint returned to the provider on that delivery. */
    responseStatus: number | null;
    delivered: boolean;
  };
}

/**
 * Ask the provider whether it has actually been delivering webhooks to `webhookUrl`.
 * This is the half a local ping can't prove: that the URL is registered on the
 * provider's side and that past real deliveries succeeded.
 */
export async function probeWebhookRegistration(
  provider: ConnectProvider,
  secretKey: string,
  webhookUrl: string,
): Promise<WebhookRegistrationProbe> {
  if (isMockGateway()) return { ok: true, deliveries: 0 };
  if (provider !== "PAGARME") return { ok: false, error: "Provedor ainda não suportado.", deliveries: 0 };

  const want = webhookUrl.replace(/\/$/, "");
  try {
    const auth = Buffer.from(`${secretKey}:`).toString("base64");
    const res = await fetch("https://api.pagar.me/core/v5/hooks?size=100", {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Chave sem permissão para ler webhooks.", deliveries: 0 };
    if (!res.ok) return { ok: false, error: `Pagar.me respondeu ${res.status} ao listar webhooks.`, deliveries: 0 };

    const body = (await res.json()) as {
      data?: Array<{ url?: string; event?: string; created_at?: string; response_status?: number | string | null }>;
    };
    const rows = body.data ?? [];
    const mine = rows
      .filter((r) => (r.url ?? "").replace(/\/$/, "") === want)
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

    const top = mine[0];
    const responseStatus = top?.response_status == null ? null : Number(top.response_status);
    return {
      ok: true,
      deliveries: rows.length,
      match: top
        ? {
            event: top.event ?? "?",
            createdAt: top.created_at ?? "",
            responseStatus: Number.isFinite(responseStatus) ? responseStatus : null,
            delivered: responseStatus != null && responseStatus >= 200 && responseStatus < 300,
          }
        : undefined,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao contatar o Pagar.me.", deliveries: 0 };
  }
}

/** Validate a secret key with an authenticated read against the provider. */
export async function probeConnection(provider: ConnectProvider, secretKey: string): Promise<ProbeResult> {
  if (isMockGateway()) return { ok: true, accountName: "Mock Gateway (dev)" };
  if (provider !== "PAGARME") return { ok: false, error: "Provedor ainda não suportado." };
  if (!/^sk_(test_)?[A-Za-z0-9]+$/.test(secretKey)) return { ok: false, error: "Chave secreta em formato inesperado." };

  try {
    const auth = Buffer.from(`${secretKey}:`).toString("base64");
    const res = await fetch("https://api.pagar.me/core/v5/orders?size=1", {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Chave secreta inválida ou sem permissão." };
    if (!res.ok) return { ok: false, error: `Pagar.me respondeu ${res.status}.` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao contatar o Pagar.me." };
  }
}
