import type {
  ChargeSnapshot,
  CreateOrderInput,
  CreateSubscriptionInput,
  GatewayKycStatus,
  OrderResult,
  OrgKycData,
  PaymentGateway,
  WebhookEvent,
} from "../types";

/**
 * In-process fake gateway for local dev and E2E. No network, deterministic ids.
 *
 * Enable with `PAYMENTS_GATEWAY=mock`. Payment outcome:
 *  - CREDIT_CARD → "paid" synchronously (card token starting with "decline"/"fail" → "failed")
 *  - PIX / BOLETO → "pending" (advance it with `POST /api/dev/pay`)
 *  - `metadata.mock` = "paid" | "pending" | "failed" overrides the above
 *
 * `verifyWebhook` does no auth — the dev-only pay endpoint is the trusted caller.
 */
export class MockGateway implements PaymentGateway {
  private id(prefix: string, seed: string) {
    return `${prefix}_mock_${seed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
  }

  async createRecipient(org: OrgKycData): Promise<{ recipientId: string }> {
    return { recipientId: this.id("rp", org.organizationId) };
  }

  async getRecipientStatus(): Promise<GatewayKycStatus> {
    return "APPROVED";
  }

  async createOrder(input: CreateOrderInput): Promise<OrderResult> {
    const gatewayOrderId = this.id("or", input.donationId);
    const gatewayChargeId = this.id("ch", input.donationId);

    const forced = input.metadata?.mock as "paid" | "pending" | "failed" | undefined;
    let status: OrderResult["status"];
    if (forced) {
      status = forced;
    } else if (input.method === "CREDIT_CARD") {
      status = /^(decline|fail)/i.test(input.cardToken ?? "") ? "failed" : "paid";
    } else {
      status = "pending";
    }

    const expiresAt = new Date(Date.now() + (input.expiresInSeconds ?? 3600) * 1000).toISOString();

    return {
      gatewayOrderId,
      gatewayChargeId,
      status,
      pix:
        input.method === "PIX" && status === "pending"
          ? {
              qrCode: `00020126MOCK-PIX-${gatewayChargeId}`,
              qrCodeUrl: `https://mock.local/pix/${gatewayChargeId}.png`,
              expiresAt,
            }
          : undefined,
      boleto:
        input.method === "BOLETO" && status === "pending"
          ? {
              line: `34191.79001 01043.510047 91020.150008 1 ${gatewayChargeId.slice(-10)}`,
              pdfUrl: `https://mock.local/boleto/${gatewayChargeId}.pdf`,
              dueAt: expiresAt,
            }
          : undefined,
    };
  }

  /** The mock can't observe state out-of-band — advance charges via /api/dev/pay. */
  async getCharge(): Promise<ChargeSnapshot | null> {
    return null;
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<{ subscriptionId: string }> {
    return { subscriptionId: this.id("sub", input.recurringPlanId) };
  }

  async cancelSubscription(): Promise<void> {
    /* no-op */
  }

  async refund(): Promise<void> {
    /* no-op */
  }

  verifyWebhook(rawBody: string): WebhookEvent {
    const parsed = JSON.parse(rawBody) as {
      id?: string;
      type: string;
      created_at?: string;
      data: Record<string, unknown>;
    };
    const entityId = typeof parsed.data?.id === "string" ? parsed.data.id : "";
    return {
      id: parsed.id ?? `${parsed.type}:${entityId}`,
      type: parsed.type,
      createdAt: parsed.created_at ?? new Date().toISOString(),
      data: parsed.data,
    };
  }
}

/** True when the fake gateway is selected. */
export function isMockGateway(): boolean {
  return process.env.PAYMENTS_GATEWAY === "mock";
}
