import { describe, it, expect } from "vitest";
import {
  EMAIL_TEMPLATES,
  EMAIL_BLOCK_TYPES,
  newEmailBlock,
  normalizeEmailBlocks,
  renderEmailBlocks,
  sanitizeInline,
} from "@donation/emails";

describe("email blocks", () => {
  it("every template default compiles to non-empty HTML matching its stored bodyHtmlDefault", () => {
    for (const kind of Object.keys(EMAIL_TEMPLATES) as (keyof typeof EMAIL_TEMPLATES)[]) {
      const meta = EMAIL_TEMPLATES[kind];
      expect(meta.blocksDefault.length).toBeGreaterThan(0);
      expect(meta.bodyHtmlDefault).toBe(renderEmailBlocks(meta.blocksDefault));
      expect(meta.bodyHtmlDefault).toContain("<table");
    }
  });

  it("keeps {TOKEN} placeholders literal for fill at send time", () => {
    const html = renderEmailBlocks([newEmailBlock("donationDetails")]);
    expect(html).toContain("{VALOR}");
    expect(html).toContain("{METODO}");
  });

  it("normalizeEmailBlocks drops unknown types and coerces bad props", () => {
    const out = normalizeEmailBlocks([
      { type: "heading", props: { text: "Oi", level: "h9", align: "sideways", color: "red" } },
      { type: "not-a-block", props: {} },
      "garbage",
      { type: "spacer", props: { height: 9999 } },
    ]);
    expect(out.map((b) => b.type)).toEqual(["heading", "spacer"]);
    expect(out[0]!.props.level).toBe("h1"); // invalid → default
    expect(out[0]!.props.align).toBe("left");
    expect(out[0]!.props.color).toBe("#2f3b37"); // non-hex → default
    expect(out[1]!.props.height).toBe(96); // clamped to max
  });

  it("normalizeEmailBlocks de-duplicates ids", () => {
    const out = normalizeEmailBlocks([
      { id: "x", type: "text", props: {} },
      { id: "x", type: "text", props: {} },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]!.id).not.toBe(out[1]!.id);
  });

  it("sanitizeInline strips scripts and disallowed tags but keeps basic formatting + safe links", () => {
    const dirty = 'oi <script>alert(1)</script><b>ok</b> <div onclick="x()">x</div> <a href="javascript:evil()">a</a> <a href="https://ok.com">b</a>';
    const clean = sanitizeInline(dirty);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("<div");
    expect(clean).not.toContain("javascript:");
    expect(clean).toContain("<b>ok</b>");
    expect(clean).toContain('href="https://ok.com"');
  });

  it("all block types have a working default", () => {
    for (const t of EMAIL_BLOCK_TYPES) {
      const b = newEmailBlock(t);
      expect(b.type).toBe(t);
      expect(() => renderEmailBlocks([b])).not.toThrow();
    }
  });
});
