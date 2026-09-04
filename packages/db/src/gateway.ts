import { ForbiddenError } from "@donation/shared";
import {
  gatewayFromConnection,
  isMockGateway,
  MockGateway,
  type ConnectProvider,
  type PaymentGateway,
} from "@donation/payments";
import { decryptSecret } from "./crypto";
import { prisma } from "./index";

export interface ResolvedOrgGateway {
  gateway: PaymentGateway;
  /** BYOG/CONNECTED: the organization owns the gateway account and receives the funds directly. */
  mode: "CONNECTED";
  provider: ConnectProvider;
  /** Publishable key for browser card tokenization. */
  publicKey: string;
  /** Per-org webhook auth secret ("user:password"). */
  webhookSecret: string;
}

/**
 * The gateway an organization transacts through. BYOG: each org connects its own
 * account (panel → Pagamentos). The former MANAGED/platform-split mode is no
 * longer offered and existing rows fail closed until migrated to CONNECTED.
 * Throws (ForbiddenError) if nothing is connected.
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

  if (cfg.mode !== "CONNECTED") {
    throw new ForbiddenError("O modo de recebimento gerenciado foi descontinuado. Conecte a conta própria da organização.");
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
