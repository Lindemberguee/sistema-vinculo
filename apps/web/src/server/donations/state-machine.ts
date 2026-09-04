import type { DonationStatus } from "@donation/db";

/**
 * Allowed donation status transitions. The webhook processor and any manual
 * admin action must go through `canTransition` before writing.
 *
 *   CREATED ─▶ PENDING ─▶ PAID ─▶ (REFUNDED | CHARGED_BACK)
 *      │          │
 *      │          ├─▶ FAILED
 *      └──────────▶ EXPIRED
 */
const TRANSITIONS: Record<DonationStatus, DonationStatus[]> = {
  CREATED: ["PENDING", "FAILED", "EXPIRED"],
  PENDING: ["PAID", "FAILED", "EXPIRED"],
  PAID: ["REFUNDED", "CHARGED_BACK"],
  FAILED: ["PENDING"], // retry
  EXPIRED: [],
  REFUNDED: [],
  CHARGED_BACK: [],
};

export function canTransition(from: DonationStatus, to: DonationStatus): boolean {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}

/** Whether this transition should move campaign/donor aggregates. */
export function aggregateDelta(from: DonationStatus, to: DonationStatus): 1 | -1 | 0 {
  const entersPaid = from !== "PAID" && to === "PAID";
  const leavesPaid = from === "PAID" && (to === "REFUNDED" || to === "CHARGED_BACK");
  if (entersPaid) return 1;
  if (leavesPaid) return -1;
  return 0;
}
