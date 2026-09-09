import { describe, expect, it } from "vitest";
import { BLOCK_REGISTRY, newBlock, safeParseBlocksDraft, type BlockType } from "@donation/blocks";
import { STARTERS } from "./palette-config";

/** Mirror of what Canvas.tsx does when a starter is picked. */
function applyStarter(key: string) {
  const s = STARTERS.find((x) => x.key === key)!;
  return s.blocks.map((b) => {
    const base = newBlock(b.type);
    return b.props ? { ...base, props: { ...base.props, ...b.props } } : base;
  });
}

describe("campaign starters", () => {
  it("every starter has a unique key", () => {
    const keys = STARTERS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every starter block is a registered type", () => {
    for (const s of STARTERS) {
      for (const b of s.blocks) {
        expect(BLOCK_REGISTRY[b.type as BlockType], `${s.key} → ${b.type}`).toBeDefined();
      }
    }
  });

  it("every starter leads with a hero and ends with a footer", () => {
    for (const s of STARTERS) {
      expect(s.blocks.slice(0, 2).some((b) => b.type === "hero"), s.key).toBe(true);
      expect(s.blocks.at(-1)?.type, s.key).toBe("footer");
    }
  });

  it("every starter offers a way to give", () => {
    const givingBlocks = new Set<BlockType>(["donationCheckout", "raffleWidget", "eventTickets", "auctionLots", "sponseeGrid"]);
    for (const s of STARTERS) {
      expect(s.blocks.some((b) => givingBlocks.has(b.type as BlockType)), s.key).toBe(true);
    }
  });

  for (const s of STARTERS) {
    it(`"${s.key}" applies to a valid draft`, () => {
      const parsed = safeParseBlocksDraft(applyStarter(s.key));
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    });
  }
});
