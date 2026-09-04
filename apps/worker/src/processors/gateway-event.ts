import { prisma } from "@donation/db";
import {
  handleSubscriptionFailure,
  markChargePaid,
  markChargeStatus,
  markSubscriptionCanceled,
  recordSubscriptionCharge,
  reverseCharge,
} from "../donations";

/**
 * Applies one Pagar.me event to our domain. Idempotent: safe to run twice for
 * the same GatewayEvent because every write is guarded by the current status.
 */
export async function processGatewayEvent(gatewayEventId: string): Promise<void> {
  const event = await prisma.gatewayEvent.findUnique({ where: { id: gatewayEventId } });
  if (!event) throw new Error(`GatewayEvent ${gatewayEventId} not found`);
  if (event.processedAt) return; // already done

  const data = event.payload as Record<string, any>;

  try {
    switch (event.type) {
      case "order.paid":
      case "charge.paid": {
        const chargeId = chargeIdOf(data);
        if (!chargeId) throw new Error("paid event without charge id");
        await markChargePaid(chargeId, gatewayFeeOf(data));
        break;
      }
      case "charge.payment_failed": {
        const subId = subscriptionIdOf(data);
        if (subId) {
          await handleSubscriptionFailure(subId);
        } else {
          const chargeId = chargeIdOf(data);
          if (chargeId) await markChargeStatus(chargeId, "FAILED");
        }
        break;
      }
      case "charge.refunded": {
        const chargeId = chargeIdOf(data);
        if (chargeId) await reverseCharge(chargeId, "REFUNDED");
        break;
      }
      case "charge.chargedback": {
        const chargeId = chargeIdOf(data);
        if (chargeId) await reverseCharge(chargeId, "CHARGED_BACK");
        break;
      }
      case "subscription.charged":
      case "invoice.paid": {
        const subId = subscriptionIdOf(data);
        const chargeId = chargeIdOf(data);
        if (subId && chargeId) await recordSubscriptionCharge({ subscriptionId: subId, chargeId, gatewayFeeCents: gatewayFeeOf(data) });
        break;
      }
      case "subscription.canceled": {
        const subId = subscriptionIdOf(data);
        if (subId) await markSubscriptionCanceled(subId);
        break;
      }
      default:
        break;
    }

    await prisma.gatewayEvent.update({
      where: { id: gatewayEventId },
      data: { processedAt: new Date(), error: null },
    });
  } catch (err) {
    await prisma.gatewayEvent.update({
      where: { id: gatewayEventId },
      data: { attempts: { increment: 1 }, error: err instanceof Error ? err.message : String(err) },
    });
    throw err; // let BullMQ retry
  }
}

function chargeIdOf(data: Record<string, any>): string | undefined {
  return data.id ?? data.charge?.id ?? data.charges?.[0]?.id ?? data.last_transaction?.charge_id;
}

function gatewayFeeOf(data: Record<string, any>): number {
  return data.last_transaction?.gateway_response?.fee ?? data.gateway_fee ?? data.fee ?? 0;
}

function subscriptionIdOf(data: Record<string, any>): string | undefined {
  return data.subscription_id ?? data.subscription?.id ?? data.invoice?.subscription_id ?? data.charge?.subscription_id;
}
