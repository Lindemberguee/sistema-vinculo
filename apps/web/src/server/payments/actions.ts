"use server";

import { randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@donation/db";
import { isAppError } from "@donation/shared";
import { probeConnection, probeWebhookRegistration, type ConnectProvider } from "@donation/payments";
import { requireOrgAccess } from "@/server/auth-helpers";
import { decryptSecret, encryptSecret, isPaymentsCryptoReady } from "@/server/crypto";
import { env } from "@/env";

export interface PaymentConnectResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Shown after a successful connect so the org can finish setup on their gateway. */
  webhook?: { url: string; user: string; password: string };
}

const APP_BASE = env.APP_BASE_DOMAIN;
const WEBHOOK_ORIGIN =
  env.PUBLIC_WEBHOOK_BASE_URL?.replace(/\/$/, "") ??
  publicOriginFor(APP_BASE.startsWith("app.") ? APP_BASE : `app.${APP_BASE}`, null);
const webhookUrlFor = (provider: ConnectProvider, orgId: string) =>
  `${WEBHOOK_ORIGIN}/api/webhooks/${provider.toLowerCase()}/${orgId}`;

const connectSchema = z.object({
  provider: z.enum(["PAGARME", "MERCADOPAGO", "ASAAS", "STRIPE"]),
  secretKey: z.string().min(10).max(200),
  publicKey: z.string().min(6).max(200),
});

export async function connectGateway(
  orgId: string,
  _prev: PaymentConnectResult | null,
  formData: FormData,
): Promise<PaymentConnectResult> {
  try {
    await requireOrgAccess(orgId, "ADMIN");
    if (!isPaymentsCryptoReady()) {
      return { ok: false, error: "O servidor não está configurado para armazenar chaves com segurança (PAYMENTS_ENC_KEY)." };
    }

    const parsed = connectSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    const { provider, secretKey, publicKey } = parsed.data;

    const probe = await probeConnection(provider, secretKey.trim());
    if (!probe.ok) return { ok: false, fieldErrors: { secretKey: [probe.error ?? "Não foi possível validar a chave."] } };

    const existing = await prisma.organizationPaymentConfig.findUnique({
      where: { organizationId: orgId },
      select: { webhookSecret: true },
    });
    // Keep the same webhook secret on reconnect so the org doesn't have to redo it.
    const webhookUser = "hook";
    const webhookPassword = existing?.webhookSecret?.split(":").slice(1).join(":") || randomBytes(30).toString("base64url");
    const webhookSecret = `${webhookUser}:${webhookPassword}`;

    await prisma.organizationPaymentConfig.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        provider,
        mode: "CONNECTED",
        secretKeyEnc: encryptSecret(secretKey.trim()),
        publicKey: publicKey.trim(),
        webhookSecret,
        verifiedAt: new Date(),
      },
      update: {
        provider,
        secretKeyEnc: encryptSecret(secretKey.trim()),
        publicKey: publicKey.trim(),
        webhookSecret,
        verifiedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: { organizationId: orgId, action: "payments.connected", entity: "OrganizationPaymentConfig", entityId: orgId, diff: { provider } },
    });

    revalidatePath(`/panel/orgs/${orgId}/pagamentos`);
    return {
      ok: true,
      webhook: { url: webhookUrlFor(provider, orgId), user: webhookUser, password: webhookPassword },
    };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
}

/** Re-verify the stored keys against the provider (they could have been revoked). */
export async function testGatewayConnection(orgId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireOrgAccess(orgId, "ADMIN");
    if (!isPaymentsCryptoReady()) return { ok: false, error: "Servidor sem PAYMENTS_ENC_KEY." };

    const cfg = await prisma.organizationPaymentConfig.findUnique({
      where: { organizationId: orgId },
      select: { provider: true, secretKeyEnc: true },
    });
    if (!cfg) return { ok: false, error: "Nenhum provedor conectado." };

    let secretKey: string;
    try {
      secretKey = decryptSecret(cfg.secretKeyEnc);
    } catch {
      return { ok: false, error: "Não foi possível ler a chave salva (chave de criptografia mudou?)." };
    }

    const probe = await probeConnection(cfg.provider as ConnectProvider, secretKey);
    if (!probe.ok) return { ok: false, error: probe.error ?? "A chave não respondeu." };

    await prisma.organizationPaymentConfig.update({
      where: { organizationId: orgId },
      data: { verifiedAt: new Date() },
    });
    revalidatePath(`/panel/orgs/${orgId}/pagamentos`);
    return { ok: true };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
}

export interface WebhookTestResult {
  ok: boolean;
  error?: string;
  /** Extra context on a passing test (e.g. tested against localhost). */
  note?: string;
  status?: number;
  /**
   * What the provider (Pagar.me) itself reports about deliveries to this URL —
   * the half a local ping can't prove. Absent when it couldn't be checked.
   */
  provider?: {
    /** true = a past real delivery to this exact URL was found on the provider. */
    registered: boolean;
    /** Human line for the UI. */
    detail: string;
    /** true when the provider check ran but hit an error (detail explains). */
    degraded?: boolean;
  };
}

/**
 * Two checks behind one button:
 *  1. Fire a signed `ping` at the org's own webhook URL — proves the URL is
 *     reachable and the Basic-Auth user/password match (what a provider POST hits).
 *  2. Ask Pagar.me itself whether it has been delivering webhooks to this URL,
 *     and how the last delivery went — proves the URL is actually registered
 *     on the provider side.
 * `urlOverride` lets a tunnel/staging host be tested instead of the derived one.
 */
export async function testWebhookEndpoint(orgId: string, urlOverride?: string): Promise<WebhookTestResult> {
  try {
    await requireOrgAccess(orgId, "ADMIN");

    const cfg = await prisma.organizationPaymentConfig.findUnique({
      where: { organizationId: orgId },
      select: { provider: true, webhookSecret: true, secretKeyEnc: true },
    });
    if (!cfg) return { ok: false, error: "Nenhum provedor conectado." };

    const path = `/api/webhooks/${cfg.provider.toLowerCase()}/${orgId}`;

    let defaultUrl: string;
    if (env.PUBLIC_WEBHOOK_BASE_URL) {
      defaultUrl = `${env.PUBLIC_WEBHOOK_BASE_URL.replace(/\/$/, "")}${path}`;
    } else {
      const h = await headers();
      const reqHost = h.get("host") ?? (APP_BASE.startsWith("app.") ? APP_BASE : `app.${APP_BASE}`);
      defaultUrl = `${publicOriginFor(reqHost, h.get("x-forwarded-proto"))}${path}`;
    }

    let target: URL;
    try {
      target = new URL(urlOverride?.trim() || defaultUrl);
    } catch {
      return { ok: false, error: "URL inválida." };
    }

    const isLocal =
      target.hostname === "localhost" ||
      target.hostname === "127.0.0.1" ||
      target.hostname.endsWith(".localhost");

    if (target.protocol !== "https:" && !(target.protocol === "http:" && isLocal)) {
      return { ok: false, error: "Use uma URL https:// (http:// só é aceito em localhost)." };
    }
    if (target.pathname !== path) {
      return { ok: false, error: `O caminho da URL precisa ser ${path}.` };
    }
    if (target.username || target.password || (target.port && !["80", "443"].includes(target.port))) {
      return { ok: false, error: "Host, credenciais ou porta não permitidos." };
    }
    if (!isLocal) {
      try {
        const resolved = await lookup(target.hostname, { all: true, verbatim: true });
        if (resolved.some(({ address }) => isPrivateAddress(address))) {
          return { ok: false, error: "Host não permitido: o endereço resolve para uma rede privada." };
        }
      } catch {
        return { ok: false, error: "Não foi possível resolver o host da URL." };
      }
    }

    // 2) What Pagar.me reports about deliveries to this URL. Best-effort — a
    //    failure here only degrades the extra context, not the ping verdict.
    let provider: WebhookTestResult["provider"];
    if (cfg.provider === "PAGARME" && isPaymentsCryptoReady()) {
      try {
        const probe = await probeWebhookRegistration("PAGARME", decryptSecret(cfg.secretKeyEnc), target.toString());
        if (!probe.ok) {
          provider = { registered: false, degraded: true, detail: `Não foi possível consultar a Pagar.me: ${probe.error ?? "erro desconhecido"}.` };
        } else if (probe.match) {
          const when = probe.match.createdAt ? new Date(probe.match.createdAt).toLocaleString("pt-BR") : "?";
          provider = probe.match.delivered
            ? { registered: true, detail: `Pagar.me: última entrega para esta URL em ${when} (${probe.match.event}) respondeu ${probe.match.responseStatus}. OK.` }
            : {
                registered: true,
                degraded: true,
                detail: `Pagar.me: última entrega para esta URL em ${when} (${probe.match.event}) falhou (HTTP ${probe.match.responseStatus ?? "?"}). Verifique usuário/senha.`,
              };
        } else {
          provider = {
            registered: false,
            detail:
              probe.deliveries > 0
                ? "Pagar.me tem entregas de webhook nesta conta, mas nenhuma para esta URL. Cadastre a URL no painel da Pagar.me."
                : "Pagar.me ainda não enviou nenhum webhook para esta conta. Cadastre a URL no painel da Pagar.me e faça uma transação de teste.",
          };
        }
      } catch {
        provider = { registered: false, degraded: true, detail: "Não foi possível ler a chave salva para consultar a Pagar.me." };
      }
    }

    // 1) Local ping — the definitive reachability + auth check.
    const auth = Buffer.from(cfg.webhookSecret).toString("base64");
    let res: Response;
    try {
      res = await fetch(target, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "content-type": "application/json" },
        body: JSON.stringify({ id: `ping_${randomBytes(8).toString("hex")}`, type: "ping", created_at: new Date().toISOString(), data: {} }),
        signal: AbortSignal.timeout(8000),
        redirect: "manual",
      });
    } catch {
      return {
        ok: false,
        provider,
        error: "Não foi possível acessar a URL. Confirme que o endereço é público (túnel/DNS) e que o servidor está no ar.",
      };
    }

    if (res.status === 401) {
      return { ok: false, status: 401, provider, error: "A URL respondeu, mas o usuário/senha do Basic Auth não conferem." };
    }
    if (res.status === 404) {
      return { ok: false, status: 404, provider, error: "URL não encontrada. Verifique o host e o caminho." };
    }
    if (res.status >= 200 && res.status < 300) {
      return {
        ok: true,
        status: res.status,
        provider,
        note: isLocal ? "Testado localmente — em produção confirme com o host público (túnel/domínio)." : undefined,
      };
    }
    return { ok: false, status: res.status, provider, error: `A URL respondeu com HTTP ${res.status}.` };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    throw err;
  }
}

function publicOriginFor(host: string, forwardedProto: string | null): string {
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
  const scheme = isLocal ? (forwardedProto ?? "http") : "https";
  return `${scheme}://${host}`;
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const octets = address.split(".").map(Number);
    const [a, b] = octets;
    if (a === undefined || b === undefined) return true;
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 0;
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:")) return isPrivateAddress(normalized.slice(7));
    return normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd");
  }
  return true;
}

/**
 * Set the webhook Basic-Auth user + password. A blank password keeps the current
 * one (so the user can rename without re-typing the secret).
 */
export async function updateWebhookCredentials(
  orgId: string,
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireOrgAccess(orgId, "ADMIN");

    const user = String(formData.get("user") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();

    if (!/^[A-Za-z0-9._-]{3,40}$/.test(user)) {
      return { ok: false, error: "Usuário: 3–40 caracteres, apenas letras, números, ponto, hífen e underline." };
    }
    if (password && (password.length < 8 || /[\s:]/.test(password))) {
      return { ok: false, error: "Senha: mínimo 8 caracteres, sem espaços nem “:”." };
    }

    const cfg = await prisma.organizationPaymentConfig.findUnique({
      where: { organizationId: orgId },
      select: { webhookSecret: true },
    });
    if (!cfg) return { ok: false, error: "Nenhum provedor conectado." };

    const currentPassword = cfg.webhookSecret.split(/:(.*)/s)[1] ?? "";
    const finalPassword = password || currentPassword || randomBytes(30).toString("base64url");

    await prisma.organizationPaymentConfig.update({
      where: { organizationId: orgId },
      data: { webhookSecret: `${user}:${finalPassword}` },
    });
    revalidatePath(`/panel/orgs/${orgId}/pagamentos`);
    return { ok: true };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}

export async function disconnectGateway(orgId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireOrgAccess(orgId, "ADMIN");
    await prisma.organizationPaymentConfig.deleteMany({ where: { organizationId: orgId } });
    await prisma.auditLog.create({
      data: { organizationId: orgId, action: "payments.disconnected", entity: "OrganizationPaymentConfig", entityId: orgId, diff: {} },
    });
    revalidatePath(`/panel/orgs/${orgId}/pagamentos`);
    return { ok: true };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    throw err;
  }
}
