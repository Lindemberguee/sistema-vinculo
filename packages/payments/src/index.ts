export * from "./types";
export * from "./fee";
export * from "./connect";
export { PagarmeGateway, type PagarmeConfig } from "./gateways/pagarme";
export { MockGateway, isMockGateway } from "./gateways/mock";
export {
  StripeGateway,
  type StripeConfig,
  type IntlCheckoutInput,
  type IntlWebhookEvent,
} from "./gateways/stripe";

import { MockGateway, isMockGateway } from "./gateways/mock";
import { StripeGateway } from "./gateways/stripe";
import type { PaymentGateway } from "./types";

let singleton: PaymentGateway | undefined;

/**
 * @deprecated Global gateway access belonged to the removed MANAGED flow.
 * Keep the symbol for backwards-compatible imports, but fail closed in
 * production so no new code can accidentally charge through the platform.
 */
export function getGateway(): PaymentGateway {
  if (singleton) return singleton;
  if (isMockGateway()) {
    singleton = new MockGateway();
    return singleton;
  }
  throw new Error("O gateway global foi descontinuado. Use a conexão BYOG da organização.");
}

let intlSingleton: StripeGateway | undefined;

export function isIntlConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

/** International (Stripe) gateway. Throws if STRIPE_* env is not set. */
export function getIntlGateway(): StripeGateway {
  if (intlSingleton) return intlSingleton;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) throw new Error("STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are not set");
  intlSingleton = new StripeGateway({ secretKey, webhookSecret });
  return intlSingleton;
}
