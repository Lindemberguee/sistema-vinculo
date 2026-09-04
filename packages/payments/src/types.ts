import type { Cents } from "@donation/shared";

export type PaymentMethod = "PIX" | "CREDIT_CARD" | "BOLETO";
export type GatewayKycStatus = "NOT_STARTED" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED";

export interface OrgKycData {
  organizationId: string;
  legalName: string;
  cnpj: string;
  email: string;
  phone: string;
  address: {
    street: string;
    number: string;
    zipCode: string;
    city: string;
    state: string;
    neighborhood: string;
  };
  bankAccount: {
    bankCode: string;
    branchNumber: string;
    accountNumber: string;
    accountCheckDigit: string;
    holderName: string;
    holderDocument: string; // CNPJ
    type: "checking" | "savings";
  };
}

export interface SplitLeg {
  recipient_id: string;
  amount: Cents;
  type: "flat" | "percentage";
  options: {
    liable: boolean;
    charge_processing_fee: boolean;
    charge_remainder_fee: boolean;
  };
}

export interface CreateOrderInput {
  /** Our Donation id — also the gateway idempotency key. */
  donationId: string;
  method: PaymentMethod;
  /** Total charged to the donor (amount + tip), in cents. */
  chargeTotalCents: Cents;
  split: SplitLeg[];
  customer: {
    name: string;
    email: string;
    document?: string; // CPF/CNPJ, digits only
    phone?: string;
  };
  /** Card payments: single-use token from the browser SDK. Never a raw PAN. */
  cardToken?: string;
  installments?: number;
  statementDescriptor?: string;
  /** Pix/boleto expiry in seconds from now. */
  expiresInSeconds?: number;
  metadata?: Record<string, string>;
}

export interface OrderResult {
  gatewayOrderId: string;
  gatewayChargeId: string;
  status: "pending" | "paid" | "failed";
  pix?: { qrCode: string; qrCodeUrl?: string; expiresAt: string };
  boleto?: { line: string; pdfUrl: string; dueAt: string };
}

export interface CreateSubscriptionInput {
  recurringPlanId: string;
  amountCents: Cents;
  intervalMonths: number;
  split: SplitLeg[];
  customer: { name: string; email: string; document?: string };
  cardToken: string;
}

export type WebhookEventType =
  | "order.paid"
  | "charge.paid"
  | "charge.payment_failed"
  | "charge.refunded"
  | "charge.chargedback"
  | "subscription.charged"
  | "subscription.canceled"
  | "recipient.updated";

export interface WebhookEvent {
  id: string;
  type: WebhookEventType | string;
  createdAt: string;
  data: Record<string, unknown>;
}

export interface ChargeSnapshot {
  status: "pending" | "paid" | "failed" | "canceled" | "overpaid" | "underpaid" | string;
  paidAt?: string;
  gatewayFeeCents?: number;
  amountCents?: number;
}

export interface PaymentGateway {
  createRecipient(org: OrgKycData): Promise<{ recipientId: string }>;
  getRecipientStatus(recipientId: string): Promise<GatewayKycStatus>;
  createOrder(input: CreateOrderInput): Promise<OrderResult>;
  /** Current state of a charge, for reconciliation. null if unknown. */
  getCharge(chargeId: string): Promise<ChargeSnapshot | null>;
  createSubscription(input: CreateSubscriptionInput): Promise<{ subscriptionId: string }>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  refund(chargeId: string, amountCents?: Cents): Promise<void>;
  /** Verify HMAC signature and parse. Throws on bad signature. */
  verifyWebhook(rawBody: string, headers: Headers): WebhookEvent;
}
