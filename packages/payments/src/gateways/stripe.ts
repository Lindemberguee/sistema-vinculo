import Stripe from "stripe";
import { PaymentError } from "@donation/shared";

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
}

export interface IntlCheckoutInput {
  donationId: string;
  organizationId: string;
  campaignId?: string | null;
  currency: string; // lowercase ISO-4217, e.g. "usd"
  amountMinor: number; // smallest unit of `currency`
  productName: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}

export interface IntlWebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

/**
 * International donations via Stripe Checkout (hosted redirect — no client SDK).
 * The only file that talks to Stripe. Split/repasse to the org is manual for
 * now (Stripe Connect is a later step).
 */
export class StripeGateway {
  private stripe: Stripe;

  constructor(private readonly config: StripeConfig) {
    if (!config.secretKey) throw new Error("StripeGateway: missing secretKey");
    this.stripe = new Stripe(config.secretKey);
  }

  async createCheckoutSession(input: IntlCheckoutInput): Promise<{ sessionId: string; url: string }> {
    try {
      const session = await this.stripe.checkout.sessions.create(
        {
          mode: "payment",
          customer_email: input.customerEmail,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: input.currency,
                unit_amount: input.amountMinor,
                product_data: { name: input.productName },
              },
            },
          ],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          metadata: {
            donationId: input.donationId,
            organizationId: input.organizationId,
            campaignId: input.campaignId ?? "",
          },
        },
        { idempotencyKey: input.donationId },
      );
      if (!session.url) throw new PaymentError("Stripe session has no URL", session);
      return { sessionId: session.id, url: session.url };
    } catch (err) {
      if (err instanceof PaymentError) throw err;
      throw new PaymentError("Stripe checkout session failed", err);
    }
  }

  verifyWebhook(rawBody: string, headers: Headers): IntlWebhookEvent {
    const sig = headers.get("stripe-signature") ?? "";
    try {
      const event = this.stripe.webhooks.constructEvent(rawBody, sig, this.config.webhookSecret);
      return { id: event.id, type: event.type, data: event.data.object as unknown as Record<string, unknown> };
    } catch (err) {
      throw new PaymentError("Invalid Stripe webhook signature", err);
    }
  }
}
