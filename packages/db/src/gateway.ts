import { ForbiddenError } from "@donation/shared";
import {
  gatewayFromConnection,
  getGateway,
  isMockGateway,
  MockGateway,
  type ConnectProvider,
  type PaymentGateway,
} from "@donation/payments";
import { decryptSecret } from "./crypto";
import { prisma } from "./index";

export interface ResolvedOrgGateway {
  gateway: PaymentGateway;
  /** CONNECTED = org's own account, no split. MANAGED = platform account + split. */
  mode: "CONNECTED" | "MANAGED";
  provider: ConnectProvider;
  /** Publishable key for browser card tokenization. */
  publicKey: string;
  /** Per-org webhook auth secret ("user:password"). */
  webhookSecret: string;
}

/**
 * The gateway an organization transacts through. BYOG: each org connects its own
 * account (panel → Pagamentos). Only orgs flagged MANAGED fall back to the
 * platform's own account + split. Throws (ForbiddenError) if nothing is connected.
 */
export async function resolveOrgGateway(organizationId: string): Promise<ResolvedOrgGateway> {
  // Dev / E2E: the fake gateway makes every org payment-ready without a config row.
  if (isMockGateway()) {
    return {
      gateway: new MockGateway(),
      mode: "CONNECTED",
      provider: "PAGARME",
      publicKey: "pk_mock",
      webhookSecret: "mock",
    };
  }

  const cfg = await prisma.organizationPaymentConfig.findUnique({
    where: { organizationId },
    select: { provider: true, mode: true, secretKeyEnc: true, publicKey: true, webhookSecret: true, verifiedAt: true },
  });
  if (!cfg) throw new ForbiddenError("A organização ainda não conectou um meio de recebimento.");
  if (!cfg.verifiedAt) throw new ForbiddenError("A conexão com o meio de recebimento não foi verificada.");

  const provider = cfg.provider as ConnectProvider;

  if (cfg.mode === "MANAGED") {
    return { gateway: getGateway(), mode: "MANAGED", provider, publicKey: cfg.publicKey, webhookSecret: cfg.webhookSecret };
  }

  const secretKey = decryptSecret(cfg.secretKeyEnc);
  return {
    gateway: gatewayFromConnection({ provider, secretKey, webhookSecret: cfg.webhookSecret }),
    mode: "CONNECTED",
    provider,
    publicKey: cfg.publicKey,
    webhookSecret: cfg.webhookSecret,
  };
}

/** Just the publishable key + connection status for the public checkout to render. */
export async function resolveOrgPublicKey(
  organizationId: string,
): Promise<{ publicKey: string; connected: boolean }> {
  if (isMockGateway()) return { publicKey: "pk_mock", connected: true };
  const cfg = await prisma.organizationPaymentConfig.findUnique({
    where: { organizationId },
    select: { publicKey: true, verifiedAt: true },
  });
  return { publicKey: cfg?.publicKey ?? "", connected: Boolean(cfg?.verifiedAt) };
}
