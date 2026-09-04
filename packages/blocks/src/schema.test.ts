import { describe, expect, it } from "vitest";
import { BLOCK_TYPES, newBlock } from "./registry";
import { parseBlocks, safeParseBlocks, PageBlocksDraft } from "./schema";

describe("block schema", () => {
  it("accepts a well-formed page", () => {
    const page = [
      { id: "a", type: "hero", props: { title: "Olá" } },
      { id: "b", type: "donationCheckout", props: {} },
    ];
    const parsed = parseBlocks(page);
    expect(parsed[0]!.type).toBe("hero");
    // defaults applied
    expect((parsed[0] as { props: { overlay: number } }).props.overlay).toBe(0.4);
  });

  it("rejects duplicate block ids", () => {
    const r = safeParseBlocks([
      { id: "dup", type: "hero", props: { title: "x" } },
      { id: "dup", type: "faq", props: { items: [{ q: "a", a: "b" }] } },
    ]);
    expect(r.success).toBe(false);
  });

  it("rejects an unknown block type", () => {
    expect(safeParseBlocks([{ id: "a", type: "carousel3d", props: {} }]).success).toBe(false);
  });

  it("rejects videoEmbed with an arbitrary src", () => {
    expect(
      safeParseBlocks([
        { id: "a", type: "videoEmbed", props: { provider: "youtube", videoId: "https://evil.example/x" } },
      ]).success,
    ).toBe(false);
  });

  it("rejects an amount option default outside the configured list", () => {
    expect(
      safeParseBlocks([{ id: "amounts", type: "amountOptions", props: { amountsCents: [1000], defaultIndex: 2 } }])
        .success,
    ).toBe(false);
  });

  it("requires quick amounts and international suggested amounts", () => {
    expect(
      safeParseBlocks([{ id: "raffle", type: "raffleWidget", props: { raffleId: "r", quickAmounts: [] } }]).success,
    ).toBe(false);
    expect(safeParseBlocks([{ id: "intl", type: "intlDonation", props: { suggestedAmounts: [] } }]).success).toBe(
      false,
    );
  });

  it("requires a URL when a call-to-action targets an external URL", () => {
    expect(safeParseBlocks([{ id: "cta", type: "cta", props: { title: "Apoie", target: "url" } }]).success).toBe(false);
    expect(safeParseBlocks([{ id: "hero", type: "hero", props: { title: "Apoie", ctaTarget: "url" } }]).success).toBe(
      false,
    );
  });

  it("draft schema accepts every registry default block (incl. half-configured module blocks)", () => {
    for (const type of BLOCK_TYPES) {
      const r = PageBlocksDraft.safeParse([newBlock(type)]);
      if (!r.success) throw new Error(`draft rejected ${type}: ${r.error.message}`);
    }
  });

  it("draft schema still rejects unknown types and duplicate ids", () => {
    expect(PageBlocksDraft.safeParse([{ id: "a", type: "carousel3d", props: {} }]).success).toBe(false);
    expect(
      PageBlocksDraft.safeParse([
        { id: "d", type: "hero", props: {} },
        { id: "d", type: "faq", props: {} },
      ]).success,
    ).toBe(false);
  });

  it("every registry default block parses", () => {
    for (const type of BLOCK_TYPES) {
      const block = newBlock(type);
      // some blocks legitimately need author input (image url, etc.) — only assert
      // that blocks with complete defaults validate
      const r = safeParseBlocks([block]);
      if (
        !r.success &&
        ![
          "image",
          "gallery",
          "videoEmbed",
          "testimonials",
          "raffleWidget",
          "eventTickets",
          "auctionLots",
          "imageText",
          "countdown",
          "pixKey",
          "embed",
        ].includes(type)
      ) {
        throw new Error(`default block ${type} failed to parse: ${r.error.message}`);
      }
    }
  });
});
