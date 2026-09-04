import { describe, expect, it } from "vitest";
import { MockGateway } from "./mock";
import type { CreateOrderInput } from "../types";

const base: CreateOrderInput = {
  donationId: "don-abc-123",
  method: "PIX",
  chargeTotalCents: 5000,
  split: [],
  customer: { name: "Ana", email: "ana@example.com" },
};

describe("MockGateway.createOrder", () => {
  const gw = new MockGateway();

  it("is deterministic on donationId (idempotent ids)", async () => {
    const a = await gw.createOrder(base);
    const b = await gw.createOrder(base);
    expect(a.gatewayChargeId).toBe(b.gatewayChargeId);
    expect(a.gatewayOrderId).toBe(b.gatewayOrderId);
    expect(a.gatewayChargeId).toMatch(/^ch_mock_/);
  });

  it("PIX comes back pending with a qr code", async () => {
    const r = await gw.createOrder(base);
    expect(r.status).toBe("pending");
    expect(r.pix?.qrCode).toContain("MOCK-PIX");
    expect(r.boleto).toBeUndefined();
  });

  it("BOLETO comes back pending with a line", async () => {
    const r = await gw.createOrder({ ...base, method: "BOLETO" });
    expect(r.status).toBe("pending");
    expect(r.boleto?.line).toBeTruthy();
    expect(r.pix).toBeUndefined();
  });

  it("CREDIT_CARD approves synchronously", async () => {
    const r = await gw.createOrder({ ...base, method: "CREDIT_CARD", cardToken: "tok_ok" });
    expect(r.status).toBe("paid");
  });

  it("CREDIT_CARD with a decline token fails", async () => {
    const r = await gw.createOrder({ ...base, method: "CREDIT_CARD", cardToken: "decline_now" });
    expect(r.status).toBe("failed");
  });

  it("metadata.mock overrides the outcome", async () => {
    const r = await gw.createOrder({ ...base, method: "PIX", metadata: { mock: "paid" } });
    expect(r.status).toBe("paid");
    expect(r.pix).toBeUndefined();
  });
});

describe("MockGateway.verifyWebhook", () => {
  it("parses without auth and normalizes the id", () => {
    const gw = new MockGateway();
    const ev = gw.verifyWebhook(JSON.stringify({ type: "charge.paid", data: { id: "ch_1", status: "paid" } }));
    expect(ev.type).toBe("charge.paid");
    expect(ev.id).toBe("charge.paid:ch_1");
    expect(ev.data.status).toBe("paid");
  });
});
