import { describe, expect, it } from "vitest";
import { linkIsLive, linkToPreset, linkUtm, type DonationLinkLike } from "./presets";
import { LINK_SLUG_ALPHABET, isLinkSlug, randomLinkSlug } from "./slug";

const base: DonationLinkLike = {
  status: "ACTIVE",
  expiresAt: null,
  amountCents: null,
  suggestedAmountsCents: [],
  lockAmount: false,
  defaultRecurring: false,
  defaultCoverFee: false,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null,
};

const campaign = { minAmountCents: 2000, suggestedAmountsCents: [2000, 5000, 10000] };

describe("linkIsLive", () => {
  it("is true for an ACTIVE link with no expiry", () => {
    expect(linkIsLive(base)).toBe(true);
  });
  it("is false when paused or archived", () => {
    expect(linkIsLive({ ...base, status: "PAUSED" })).toBe(false);
    expect(linkIsLive({ ...base, status: "ARCHIVED" })).toBe(false);
  });
  it("is false once the expiry has passed", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(linkIsLive({ ...base, expiresAt: new Date("2026-05-31T23:59:00Z") }, now)).toBe(false);
    expect(linkIsLive({ ...base, expiresAt: new Date("2026-06-02T00:00:00Z") }, now)).toBe(true);
  });
});

describe("linkToPreset", () => {
  it("falls back to the campaign's suggested amounts", () => {
    expect(linkToPreset(base, campaign).suggestedAmountsCents).toEqual([2000, 5000, 10000]);
  });
  it("keeps the link's own suggested amounts when set", () => {
    expect(linkToPreset({ ...base, suggestedAmountsCents: [3000, 7000] }, campaign).suggestedAmountsCents).toEqual([
      3000, 7000,
    ]);
  });
  it("clamps a preset amount up to the campaign minimum", () => {
    expect(linkToPreset({ ...base, amountCents: 500 }, campaign).amountCents).toBe(2000);
    expect(linkToPreset({ ...base, amountCents: 9000 }, campaign).amountCents).toBe(9000);
  });
  it("ignores a lock when there is no amount", () => {
    expect(linkToPreset({ ...base, lockAmount: true }, campaign).lockAmount).toBe(false);
    expect(linkToPreset({ ...base, lockAmount: true, amountCents: 5000 }, campaign).lockAmount).toBe(true);
  });
  it("collects only the utm keys that are set", () => {
    expect(linkUtm({ ...base, utmSource: "instagram", utmMedium: "bio" })).toEqual({
      utmSource: "instagram",
      utmMedium: "bio",
    });
    expect(linkToPreset(base, campaign).utm).toEqual({});
  });
});

describe("randomLinkSlug", () => {
  it("respects the requested length and alphabet", () => {
    for (let i = 0; i < 200; i += 1) {
      const s = randomLinkSlug(7);
      expect(s).toHaveLength(7);
      expect([...s].every((c) => LINK_SLUG_ALPHABET.includes(c))).toBe(true);
    }
  });
  it("never contains ambiguous characters", () => {
    const joined = Array.from({ length: 500 }, () => randomLinkSlug()).join("");
    expect(/[01lio]/.test(joined)).toBe(false);
  });
  it("is highly unlikely to collide across a small batch", () => {
    const seen = new Set(Array.from({ length: 1000 }, () => randomLinkSlug()));
    expect(seen.size).toBeGreaterThan(995);
  });
  it("isLinkSlug accepts generated slugs and rejects junk", () => {
    expect(isLinkSlug(randomLinkSlug())).toBe(true);
    expect(isLinkSlug("AB!")).toBe(false);
    expect(isLinkSlug("historias-que-transformam")).toBe(false);
  });
});
