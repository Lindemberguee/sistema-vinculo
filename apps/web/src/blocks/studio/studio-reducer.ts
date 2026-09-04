import { newBlock, type BlockType } from "@donation/blocks";

/**
 * Pure state model for the Studio editor. No React, no side effects, no module
 * mutable counters — every action is a pure function of (state, action) so
 * undo/redo, reorder and drop-resolution are unit-testable and StrictMode-safe.
 */

export type EditorBlock = { id: string; type: BlockType; props: Record<string, unknown> };
export type Device = "desktop" | "mobile";

export interface StudioState {
  blocks: EditorBlock[];
  selectedId: string | null;
  device: Device;
  past: EditorBlock[][];
  future: EditorBlock[][];
  /** Signature of the last mutation; consecutive matches collapse into one undo step. */
  lastMutation: string | null;
}

export type StudioAction =
  | { type: "insert"; blockType: BlockType; index?: number }
  | { type: "move"; from: number; to: number }
  | { type: "duplicate"; id: string }
  | { type: "remove"; id: string }
  | { type: "patchProps"; id: string; patch: Record<string, unknown> }
  | { type: "select"; id: string | null }
  | { type: "setDevice"; device: Device }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; blocks: EditorBlock[]; keepHistory?: boolean };

const HISTORY_LIMIT = 60;

function newId(type: BlockType) {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${type}-${rnd}`;
}

export function initStudio(blocks: EditorBlock[]): StudioState {
  return {
    blocks,
    selectedId: blocks[0]?.id ?? null,
    device: "desktop",
    past: [],
    future: [],
    lastMutation: null,
  };
}

/** Fold a new blocks array into state, recording an undo frame.
 * `coalesceKey` null = always a discrete step; a repeated key merges. */
function commit(state: StudioState, nextBlocks: EditorBlock[], coalesceKey: string | null): StudioState {
  const coalesce = coalesceKey !== null && coalesceKey === state.lastMutation;
  return {
    ...state,
    blocks: nextBlocks,
    past: coalesce ? state.past : [...state.past, state.blocks].slice(-HISTORY_LIMIT),
    future: [],
    lastMutation: coalesceKey,
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case "insert": {
      const block = newBlock(action.blockType) as EditorBlock;
      const at = action.index === undefined ? state.blocks.length : clamp(action.index, 0, state.blocks.length);
      const blocks = [...state.blocks.slice(0, at), block, ...state.blocks.slice(at)];
      return { ...commit(state, blocks, null), selectedId: block.id };
    }

    case "move": {
      const { from, to } = action;
      if (from === to || from < 0 || from >= state.blocks.length) return state;
      const blocks = [...state.blocks];
      const [moved] = blocks.splice(from, 1);
      if (!moved) return state;
      blocks.splice(clamp(to, 0, blocks.length), 0, moved);
      return commit(state, blocks, null);
    }

    case "duplicate": {
      const i = state.blocks.findIndex((b) => b.id === action.id);
      if (i === -1) return state;
      const src = state.blocks[i]!;
      const copy: EditorBlock = { id: newId(src.type), type: src.type, props: structuredClone(src.props) };
      const blocks = [...state.blocks.slice(0, i + 1), copy, ...state.blocks.slice(i + 1)];
      return { ...commit(state, blocks, null), selectedId: copy.id };
    }

    case "remove": {
      const i = state.blocks.findIndex((b) => b.id === action.id);
      if (i === -1) return state;
      const blocks = state.blocks.filter((b) => b.id !== action.id);
      const selectedId =
        state.selectedId === action.id ? (blocks[i]?.id ?? blocks[i - 1]?.id ?? null) : state.selectedId;
      return { ...commit(state, blocks, null), selectedId };
    }

    case "patchProps": {
      if (!state.blocks.some((b) => b.id === action.id)) return state;
      const blocks = state.blocks.map((b) =>
        b.id === action.id ? { ...b, props: { ...b.props, ...action.patch } } : b,
      );
      return commit(state, blocks, `patch:${action.id}:${Object.keys(action.patch).join(",")}`);
    }

    case "select":
      return state.selectedId === action.id ? state : { ...state, selectedId: action.id, lastMutation: null };

    case "setDevice":
      return { ...state, device: action.device, lastMutation: null };

    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1]!;
      return {
        ...state,
        blocks: previous,
        past: state.past.slice(0, -1),
        future: [state.blocks, ...state.future].slice(0, HISTORY_LIMIT),
        lastMutation: null,
        selectedId: previous.some((b) => b.id === state.selectedId) ? state.selectedId : (previous[0]?.id ?? null),
      };
    }

    case "redo": {
      if (state.future.length === 0) return state;
      const next = state.future[0]!;
      return {
        ...state,
        blocks: next,
        past: [...state.past, state.blocks].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        lastMutation: null,
        selectedId: next.some((b) => b.id === state.selectedId) ? state.selectedId : (next[0]?.id ?? null),
      };
    }

    case "reset":
      if (action.keepHistory) {
        return { ...commit(state, action.blocks, null), selectedId: action.blocks[0]?.id ?? null };
      }
      return initStudio(action.blocks);

    default:
      return state;
  }
}

/**
 * Turn a dnd-kit drag result into a reducer action. Pure so the drop math is
 * tested alongside the reducer instead of buried in an event handler.
 */
export function resolveDrop(
  blocks: EditorBlock[],
  activeData: { from?: string; blockType?: BlockType } | null | undefined,
  activeId: string,
  overId: string | null | undefined,
): StudioAction | null {
  if (activeData?.from === "palette" && activeData.blockType) {
    if (!overId || overId === "canvas-end") return { type: "insert", blockType: activeData.blockType };
    const idx = blocks.findIndex((b) => b.id === overId);
    return { type: "insert", blockType: activeData.blockType, index: idx === -1 ? undefined : idx };
  }
  if (!overId || overId === activeId) return null;
  const from = blocks.findIndex((b) => b.id === activeId);
  const to = overId === "canvas-end" ? blocks.length - 1 : blocks.findIndex((b) => b.id === overId);
  if (from === -1 || to === -1 || from === to) return null;
  return { type: "move", from, to };
}
