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

import { PagarmeGateway } from "./gateways/pagarme";
import { MockGateway, isMockGateway } from "./gateways/mock";
import { StripeGateway } from "./gateways/stripe";
import type { PaymentGateway } from "./types";

let singleton: PaymentGateway | undefined;

/** Returns the configured gateway. Swap the implementation here to change providers. */
export function getGateway(): PaymentGateway {
  if (singleton) return singleton;
  if (isMockGateway()) {
    singleton = new MockGateway();
    return singleton;
  }
  const secretKey = process.env.PAGARME_SECRET_KEY;
  const webhookSecret = process.env.PAGARME_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    throw new Error("PAGARME_SECRET_KEY / PAGARME_WEBHOOK_SECRET are not set");
  }
  singleton = new PagarmeGateway({ secretKey, webhookSecret });
  return singleton;
}

export const PLATFORM_RECIPIENT_ID = () => {
  const id = process.env.PLATFORM_RECIPIENT_ID;
  if (!id) throw new Error("PLATFORM_RECIPIENT_ID is not set");
  return id;
};

/**
 * Whether the Pagar.me account is enabled for split (marketplace). Until it is,
 * `PLATFORM_RECIPIENT_ID` stays as the `rp_placeholder` sentinel and charges are
 * created without a `split[]` — money lands on the account's own balance. Set a
 * real `rp_...` once Pagar.me enables recipient creation on the account.
 */
export function isSplitEnabled(): boolean {
  const id = process.env.PLATFORM_RECIPIENT_ID ?? "";
  return id.startsWith("rp_") && !id.includes("placeholder");
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
