import "server-only";

/**
 * Connected-gateway (BYOG) resolution lives in @donation/db so the worker can use
 * it too. These are kept as re-exports under the old names to avoid churn.
 */
export {
  resolveOrgGateway as getOrgGateway,
  resolveOrgPublicKey as getOrgPublicPaymentInfo,
  type ResolvedOrgGateway as ResolvedGateway,
} from "@donation/db";
