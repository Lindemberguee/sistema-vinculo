import { describe, expect, it } from "vitest";
import { buildSplit, calculateFees, type FeeConfig } from "./fee";

const FREE: FeeConfig = { platformFeeBps: 690, platformFeeFixedCents: 0 };
const ESSENCIAL: FeeConfig = { platformFeeBps: 490, platformFeeFixedCents: 0 };
const PRO: FeeConfig = { platformFeeBps: 390, platformFeeFixedCents: 0 };
const WITH_FIXED: FeeConfig = { platformFeeBps: 390, platformFeeFixedCents: 100 };

describe("calculateFees", () => {
  it("applies a percentage fee with ceil rounding", () => {
    // 5000 * 4.9% = 245.0 exactly
    const r = calculateFees({ amountCents: 5000, config: ESSENCIAL });
    expect(r.platformFeeCents).toBe(245);
    expect(r.netToOrgCents).toBe(4755);
    expect(r.chargeTotalCents).toBe(5000);
  });

  it("rounds the platform fee up, never down", () => {
    // 3333 * 3.9% = 129.987 -> ceil -> 130
    const r = calculateFees({ amountCents: 3333, config: PRO });
    expect(r.platformFeeCents).toBe(130);
    expect(r.netToOrgCents).toBe(3203);
  });

  it("adds the flat fixed fee on top of the percentage", () => {
    // 10000 * 3.9% = 390 ; + 100 fixed = 490
    const r = calculateFees({ amountCents: 10000, config: WITH_FIXED });
    expect(r.grossPlatformFeeCents).toBe(490);
    expect(r.platformFeeCents).toBe(490);
    expect(r.netToOrgCents).toBe(9510);
  });

  it("keeps the platform fee whole when the donor tips (tip funds it, not waives it)", () => {
    const r = calculateFees({ amountCents: 10000, tipCents: 300, config: PRO });
    // Platform always keeps its 390. Tip covers 300 of it, org absorbs the other 90.
    expect(r.platformFeeCents).toBe(390);
    expect(r.orgFeeBorneCents).toBe(90); // 390 - 300
    expect(r.chargeTotalCents).toBe(10300);
    expect(r.netToOrgCents).toBe(9910); // donation 10000 - 90 the tip didn't cover
  });

  it("gives the org 100% of the donation when the tip fully covers the fee", () => {
    const r = calculateFees({ amountCents: 10000, tipCents: 390, config: PRO });
    expect(r.platformFeeCents).toBe(390);
    expect(r.orgFeeBorneCents).toBe(0);
    expect(r.netToOrgCents).toBe(10000); // exactly the donation
  });

  it("routes tip beyond the fee to the org, platform still keeps only its fee", () => {
    const r = calculateFees({ amountCents: 10000, tipCents: 5000, config: PRO });
    expect(r.platformFeeCents).toBe(390);
    expect(r.orgFeeBorneCents).toBe(0);
    expect(r.netToOrgCents).toBe(14610); // 10000 donation + 4610 leftover tip
  });

  it("always reconciles: netToOrg + platformFee === chargeTotal", () => {
    for (const amount of [500, 999, 1000, 1234, 4999, 5000, 7777, 100000, 999999]) {
      for (const tip of [0, 50, 199, 500, 10000]) {
        for (const cfg of [FREE, ESSENCIAL, PRO, WITH_FIXED]) {
          const r = calculateFees({ amountCents: amount, tipCents: tip, config: cfg });
          expect(r.netToOrgCents + r.platformFeeCents).toBe(r.chargeTotalCents);
          expect(r.netToOrgCents).toBeGreaterThan(0);
          expect(Number.isInteger(r.platformFeeCents)).toBe(true);
          expect(Number.isInteger(r.netToOrgCents)).toBe(true);
        }
      }
    }
  });

  it("rejects a donation too small to cover the fixed fee", () => {
    expect(() => calculateFees({ amountCents: 50, config: { platformFeeBps: 390, platformFeeFixedCents: 100 } })).toThrow(
      /net to org/i,
    );
  });

  it("rejects zero, negative and non-integer amounts", () => {
    expect(() => calculateFees({ amountCents: 0, config: PRO })).toThrow();
    expect(() => calculateFees({ amountCents: -100, config: PRO })).toThrow();
    expect(() => calculateFees({ amountCents: 10.5, config: PRO })).toThrow();
  });

  it("rejects an out-of-range bps config", () => {
    expect(() => calculateFees({ amountCents: 1000, config: { platformFeeBps: 20000, platformFeeFixedCents: 0 } })).toThrow();
    expect(() => calculateFees({ amountCents: 1000, config: { platformFeeBps: -1, platformFeeFixedCents: 0 } })).toThrow();
  });
});

describe("buildSplit", () => {
  it("produces two legs that sum to the charge total", () => {
    const breakdown = calculateFees({ amountCents: 10000, tipCents: 200, config: ESSENCIAL });
    const split = buildSplit({ breakdown, orgRecipientId: "rp_org", platformRecipientId: "rp_platform" });
    expect(split).toHaveLength(2);
    expect(split[0]!.amount + split[1]!.amount).toBe(breakdown.chargeTotalCents);
    expect(split[0]!.recipient_id).toBe("rp_org");
    expect(split[1]!.options.charge_processing_fee).toBe(true);
    expect(split[0]!.options.charge_processing_fee).toBe(false);
  });
});
