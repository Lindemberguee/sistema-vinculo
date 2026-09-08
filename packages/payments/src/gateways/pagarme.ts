import { timingSafeEqual } from "node:crypto";
import { PaymentError } from "@donation/shared";
import type {
  CreateOrderInput,
  CreateSubscriptionInput,
  GatewayKycStatus,
  OrderResult,
  OrgKycData,
  PaymentGateway,
  WebhookEvent,
} from "../types";

const API_BASE = "https://api.pagar.me/core/v5";

export interface PagarmeConfig {
  secretKey: string;
  webhookSecret: string;
}

/**
 * Pagar.me v5 adapter. The only file in the codebase that talks to Pagar.me.
 * Network calls are intentionally thin — the domain layer owns fee math,
 * idempotency keys, and persistence.
 */
export class PagarmeGateway implements PaymentGateway {
  constructor(private readonly config: PagarmeConfig) {
    if (!config.secretKey) throw new Error("PagarmeGateway: missing secretKey");
  }

  private async request<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
    const auth = Buffer.from(`${this.config.secretKey}:`).toString("base64");
    const headers: Record<string, string> = {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;

    const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    const text = await res.text();
    const body = text ? (JSON.parse(text) as unknown) : {};

    if (!res.ok) {
      throw new PaymentError(`Pagar.me ${init.method ?? "GET"} ${path} -> ${res.status}`, body);
    }
    return body as T;
  }

  async createRecipient(org: OrgKycData): Promise<{ recipientId: string }> {
    const payload = {
      register_information: {
        type: "corporation",
        company_name: org.legalName,
        document: org.cnpj,
        email: org.email,
        address: {
          street: org.address.street,
          street_number: org.address.number,
          zip_code: org.address.zipCode,
          city: org.address.city,
          state: org.address.state,
          neighborhood: org.address.neighborhood,
          reference_point: "N/A",
        },
        phone_numbers: [{ ddd: org.phone.slice(0, 2), number: org.phone.slice(2), type: "mobile" }],
      },
      default_bank_account: {
        holder_name: org.bankAccount.holderName,
        holder_type: "company",
        holder_document: org.bankAccount.holderDocument,
        bank: org.bankAccount.bankCode,
        branch_number: org.bankAccount.branchNumber,
        account_number: org.bankAccount.accountNumber,
        account_check_digit: org.bankAccount.accountCheckDigit,
        type: org.bankAccount.type === "savings" ? "savings" : "checking",
      },
      transfer_settings: { transfer_enabled: true, transfer_interval: "Weekly", transfer_day: 5 },
      automatic_anticipation_settings: { enabled: false },
      code: org.organizationId,
    };

    const r = await this.request<{ id: string }>("/recipients", {
      method: "POST",
      body: JSON.stringify(payload),
      idempotencyKey: `recipient:${org.organizationId}`,
    });
    return { recipientId: r.id };
  }

  async getRecipientStatus(recipientId: string): Promise<GatewayKycStatus> {
    const r = await this.request<{ status: string; kyc_details?: { status?: string } }>(`/recipients/${recipientId}`);
    const raw = (r.kyc_details?.status ?? r.status ?? "").toLowerCase();
    if (raw.includes("approv") || raw === "active" || raw === "registration") return "APPROVED";
    if (raw.includes("refus") || raw.includes("reject") || raw.includes("block")) return "REJECTED";
    if (raw.includes("review") || raw.includes("analysis")) return "IN_REVIEW";
    if (raw) return "SUBMITTED";
    return "NOT_STARTED";
  }

  async createOrder(input: CreateOrderInput): Promise<OrderResult> {
    const payment = this.buildPayment(input);

    const phones = brPhones(input.customer.phone);
    const order = await this.request<PagarmeOrder>("/orders", {
      method: "POST",
      idempotencyKey: input.donationId,
      body: JSON.stringify({
        code: input.donationId,
        customer: {
          name: input.customer.name,
          email: input.customer.email,
          document: input.customer.document,
          document_type: (input.customer.document ?? "").replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF",
          type: "individual",
          ...(phones ? { phones } : {}),
        },
        items: [{ code: "doacao", amount: input.chargeTotalCents, description: "Doação", quantity: 1 }],
        payments: [payment],
        metadata: input.metadata,
      }),
    });

    const charge = order.charges?.[0];
    if (!charge) throw new PaymentError("Pagar.me order returned no charge", order);

    const tx = charge.last_transaction ?? {};
    if (charge.status === "failed") {
      console.error("[pagarme] charge failed:", JSON.stringify({ order_id: order.id, charge_id: charge.id, status: charge.status, last_transaction: tx }, null, 2));
    }
    // Map by the method we asked for — a boleto transaction also carries a
    // `qr_code` (boleto híbrido), so field-sniffing picks the wrong one.
    return {
      gatewayOrderId: order.id,
      gatewayChargeId: charge.id,
      status: charge.status === "paid" ? "paid" : charge.status === "failed" ? "failed" : "pending",
      pix:
        input.method === "PIX" && tx.qr_code
          ? { qrCode: tx.qr_code, qrCodeUrl: tx.qr_code_url, expiresAt: tx.expires_at ?? "" }
          : undefined,
      boleto:
        input.method === "BOLETO" && (tx.line || tx.barcode)
          ? { line: tx.line ?? tx.barcode ?? "", pdfUrl: tx.pdf ?? tx.url ?? "", dueAt: tx.due_at ?? "" }
          : undefined,
    };
  }

  async getCharge(chargeId: string) {
    try {
      const c = await this.request<{
        status?: string;
        paid_at?: string;
        amount?: number;
        last_transaction?: { gateway_response?: { fee?: number } };
      }>(`/charges/${chargeId}`);
      return {
        status: c.status ?? "unknown",
        paidAt: c.paid_at,
        amountCents: c.amount,
        gatewayFeeCents: c.last_transaction?.gateway_response?.fee,
      };
    } catch (err) {
      if (err instanceof PaymentError && /-> 404/.test(err.message)) return null;
      throw err;
    }
  }

  private buildPayment(input: CreateOrderInput) {
    // Omit `split` entirely when there are no recipients (marketplace not yet
    // enabled) — the charge then settles to the account's own balance.
    const split = input.split.length
      ? {
          split: input.split.map((s) => ({
            recipient_id: s.recipient_id,
            amount: s.amount,
            type: s.type,
            options: s.options,
          })),
        }
      : {};

    switch (input.method) {
      case "PIX":
        return {
          payment_method: "pix",
          pix: { expires_in: input.expiresInSeconds ?? 3600 },
          ...split,
        };
      case "BOLETO":
        return {
          payment_method: "boleto",
          boleto: { instructions: "Não receber após o vencimento.", due_at: isoInSeconds(input.expiresInSeconds ?? 259200) },
          ...split,
        };
      case "CREDIT_CARD":
        if (!input.cardToken) throw new PaymentError("CREDIT_CARD order requires cardToken");
        return {
          payment_method: "credit_card",
          credit_card: {
            installments: input.installments ?? 1,
            statement_descriptor: input.statementDescriptor ?? "DOACAO",
            card_token: input.cardToken,
          },
          ...split,
        };
      default:
        throw new PaymentError(`Unsupported method: ${String(input.method)}`);
    }
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<{ subscriptionId: string }> {
    const r = await this.request<{ id: string }>("/subscriptions", {
      method: "POST",
      idempotencyKey: `sub:${input.recurringPlanId}`,
      body: JSON.stringify({
        code: input.recurringPlanId,
        payment_method: "credit_card",
        interval: "month",
        interval_count: input.intervalMonths,
        billing_type: "prepaid",
        customer: { name: input.customer.name, email: input.customer.email, document: input.customer.document, type: "individual" },
        card_token: input.cardToken,
        items: [{ description: "Doação recorrente", quantity: 1, pricing_scheme: { price: input.amountCents } }],
        ...(input.split.length ? { split: input.split } : {}),
      }),
    });
    return { subscriptionId: r.id };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.request(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
  }

  async refund(chargeId: string, amountCents?: number): Promise<void> {
    await this.request(`/charges/${chargeId}`, {
      method: "DELETE",
      body: JSON.stringify(amountCents ? { amount: amountCents } : {}),
    });
  }

  /**
   * Pagar.me v5 authenticates webhooks with HTTP Basic Auth (a user/password you
   * define on the webhook in the dashboard) — NOT the v4 `X-Hub-Signature` HMAC.
   * `webhookSecret` here is the `user:password` string configured on both sides.
   * Set it to `insecure-sandbox` to skip the check (sandbox only — the URL is the
   * only thing guarding the endpoint then).
   */
  verifyWebhook(rawBody: string, headers: Headers): WebhookEvent {
    if (this.config.webhookSecret !== "insecure-sandbox") {
      const header = headers.get("authorization") ?? "";
      const encoded = /^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(header.trim())?.[1] ?? "";
      const provided = encoded ? Buffer.from(encoded, "base64").toString("utf8") : "";
      const a = Buffer.from(provided);
      const b = Buffer.from(this.config.webhookSecret);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        const [providedUser = "", providedPassword = ""] = provided.split(/:(.*)/s);
        const [expectedUser = "", expectedPassword = ""] = this.config.webhookSecret.split(/:(.*)/s);
        console.warn(
          "[pagarme] invalid webhook auth",
          JSON.stringify({
            hasAuthorization: Boolean(header),
            hasBasicAuthorization: Boolean(encoded),
            providedUser,
            expectedUser,
            providedLength: provided.length,
            expectedLength: this.config.webhookSecret.length,
            providedPasswordLength: providedPassword.length,
            expectedPasswordLength: expectedPassword.length,
          }),
        );
        throw new PaymentError("Invalid webhook auth");
      }
    }

    const parsed = JSON.parse(rawBody) as {
      id?: string;
      type: string;
      created_at?: string;
      data: Record<string, unknown>;
    };
    // v5 event ids are stable across retries; fall back to type+entity if absent.
    const entityId = typeof parsed.data?.id === "string" ? parsed.data.id : "";
    return {
      id: parsed.id ?? `${parsed.type}:${entityId}`,
      type: parsed.type,
      createdAt: parsed.created_at ?? new Date().toISOString(),
      data: parsed.data,
    };
  }
}

function isoInSeconds(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/** Pagar.me v5 `customer.phones` from a raw BR phone string. Pix/boleto require it. */
function brPhones(raw: string | undefined): { mobile_phone: { country_code: string; area_code: string; number: string } } | null {
  const digits = (raw ?? "").replace(/\D/g, "").replace(/^55/, "");
  if (digits.length < 10) return null;
  return {
    mobile_phone: { country_code: "55", area_code: digits.slice(0, 2), number: digits.slice(2) },
  };
}

// ── Minimal shapes of the Pagar.me responses we read ──
interface PagarmeOrder {
  id: string;
  charges?: Array<{
    id: string;
    status: string;
    last_transaction?: {
      qr_code?: string;
      qr_code_url?: string;
      expires_at?: string;
      line?: string;
      barcode?: string;
      pdf?: string;
      url?: string;
      due_at?: string;
    };
  }>;
}
