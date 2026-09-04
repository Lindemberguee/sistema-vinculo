import { describe, expect, it } from "vitest";
import { initStudio, studioReducer, resolveDrop, type EditorBlock } from "./studio-reducer";

const b = (id: string, type = "richText"): EditorBlock => ({ id, type: type as EditorBlock["type"], props: {} });

describe("studioReducer", () => {
  it("inserts at index and selects the new block", () => {
    let s = initStudio([b("a"), b("c")]);
    s = studioReducer(s, { type: "insert", blockType: "hero", index: 1 });
    expect(s.blocks.map((x) => x.type)).toEqual(["richText", "hero", "richText"]);
    expect(s.selectedId).toBe(s.blocks[1]!.id);
  });

  it("insert with no index appends", () => {
    let s = initStudio([b("a")]);
    s = studioReducer(s, { type: "insert", blockType: "faq" });
    expect(s.blocks[s.blocks.length - 1]!.type).toBe("faq");
  });

  it("consecutive inserts are separate undo steps", () => {
    let s = initStudio([]);
    s = studioReducer(s, { type: "insert", blockType: "hero" });
    s = studioReducer(s, { type: "insert", blockType: "faq" });
    expect(s.past.length).toBe(2);
  });

  it("moves a block", () => {
    let s = initStudio([b("a"), b("b"), b("c")]);
    s = studioReducer(s, { type: "move", from: 0, to: 2 });
    expect(s.blocks.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("duplicates right after the source with a fresh id", () => {
    let s = initStudio([b("a"), b("b")]);
    s = studioReducer(s, { type: "duplicate", id: "a" });
    expect(s.blocks.map((x) => x.id).slice(0, 2)).toEqual(["a", s.blocks[1]!.id]);
    expect(s.blocks[1]!.id).not.toBe("a");
    expect(s.selectedId).toBe(s.blocks[1]!.id);
  });

  it("removes a block and reselects a neighbour", () => {
    let s = initStudio([b("a"), b("b"), b("c")]);
    s = studioReducer(s, { type: "select", id: "b" });
    s = studioReducer(s, { type: "remove", id: "b" });
    expect(s.blocks.map((x) => x.id)).toEqual(["a", "c"]);
    expect(s.selectedId).toBe("c");
  });

  it("patchProps merges and undo restores", () => {
    let s = initStudio([b("a")]);
    s = studioReducer(s, { type: "patchProps", id: "a", patch: { title: "Hello" } });
    expect(s.blocks[0]!.props.title).toBe("Hello");
    s = studioReducer(s, { type: "undo" });
    expect(s.blocks[0]!.props.title).toBeUndefined();
  });

  it("patchProps for an unknown id is a no-op", () => {
    const s0 = initStudio([b("a")]);
    const s1 = studioReducer(s0, { type: "patchProps", id: "ghost", patch: { x: 1 } });
    expect(s1).toBe(s0);
  });

  it("coalesces consecutive edits to the same field into one undo step", () => {
    let s = initStudio([b("a")]);
    s = studioReducer(s, { type: "patchProps", id: "a", patch: { title: "H" } });
    s = studioReducer(s, { type: "patchProps", id: "a", patch: { title: "He" } });
    s = studioReducer(s, { type: "patchProps", id: "a", patch: { title: "Hey" } });
    expect(s.past.length).toBe(1);
    s = studioReducer(s, { type: "undo" });
    expect(s.blocks[0]!.props.title).toBeUndefined();
  });

  it("does not coalesce edits to different fields", () => {
    let s = initStudio([b("a")]);
    s = studioReducer(s, { type: "patchProps", id: "a", patch: { title: "x" } });
    s = studioReducer(s, { type: "patchProps", id: "a", patch: { subtitle: "y" } });
    expect(s.past.length).toBe(2);
  });

  it("a selection between edits breaks the coalescing chain", () => {
    let s = initStudio([b("a"), b("c")]);
    s = studioReducer(s, { type: "patchProps", id: "a", patch: { title: "x" } });
    s = studioReducer(s, { type: "select", id: "c" });
    s = studioReducer(s, { type: "select", id: "a" });
    s = studioReducer(s, { type: "patchProps", id: "a", patch: { title: "xy" } });
    expect(s.past.length).toBe(2);
  });

  it("redo replays an undone change; new mutation clears the redo stack", () => {
    let s = initStudio([b("a")]);
    s = studioReducer(s, { type: "insert", blockType: "hero" });
    s = studioReducer(s, { type: "undo" });
    expect(s.blocks.length).toBe(1);
    s = studioReducer(s, { type: "redo" });
    expect(s.blocks.length).toBe(2);
    s = studioReducer(s, { type: "undo" });
    s = studioReducer(s, { type: "insert", blockType: "faq" });
    expect(s.future).toHaveLength(0);
  });

  it("reset with keepHistory records an undo frame", () => {
    let s = initStudio([b("a")]);
    s = studioReducer(s, { type: "reset", blocks: [b("x"), b("y")], keepHistory: true });
    expect(s.blocks.map((x) => x.id)).toEqual(["x", "y"]);
    s = studioReducer(s, { type: "undo" });
    expect(s.blocks.map((x) => x.id)).toEqual(["a"]);
  });

  it("move is a no-op when from === to", () => {
    const s0 = initStudio([b("a"), b("b")]);
    expect(studioReducer(s0, { type: "move", from: 1, to: 1 })).toBe(s0);
  });
});

describe("resolveDrop", () => {
  const blocks = [b("a"), b("b"), b("c")];

  it("palette drop over a block inserts before it", () => {
    expect(resolveDrop(blocks, { from: "palette", blockType: "hero" }, "palette:hero", "b")).toEqual({
      type: "insert",
      blockType: "hero",
      index: 1,
    });
  });

  it("palette drop on the end zone appends", () => {
    expect(resolveDrop(blocks, { from: "palette", blockType: "cta" }, "palette:cta", "canvas-end")).toEqual({
      type: "insert",
      blockType: "cta",
    });
  });

  it("palette drop with no target appends", () => {
    expect(resolveDrop(blocks, { from: "palette", blockType: "faq" }, "palette:faq", null)).toEqual({
      type: "insert",
      blockType: "faq",
    });
  });

  it("reorder resolves to a move", () => {
    expect(resolveDrop(blocks, null, "a", "c")).toEqual({ type: "move", from: 0, to: 2 });
  });

  it("reorder onto the end zone moves to last", () => {
    expect(resolveDrop(blocks, null, "a", "canvas-end")).toEqual({ type: "move", from: 0, to: 2 });
  });

  it("dropping onto itself is a no-op", () => {
    expect(resolveDrop(blocks, null, "b", "b")).toBeNull();
  });
});
