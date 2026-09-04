import { newEmailBlock, type EmailBlock, type EmailBlockType } from "@donation/emails";

/**
 * Pure state model for the e-mail builder. No React / side effects, so drop
 * math, reorder and undo/redo are unit-testable.
 */

export interface BuilderState {
  blocks: EmailBlock[];
  selectedId: string | null;
  past: EmailBlock[][];
  future: EmailBlock[][];
  lastMutation: string | null;
}

export type BuilderAction =
  | { type: "insert"; blockType: EmailBlockType; index?: number }
  | { type: "move"; from: number; to: number }
  | { type: "duplicate"; id: string }
  | { type: "remove"; id: string }
  | { type: "patch"; id: string; patch: Record<string, unknown> }
  | { type: "select"; id: string | null }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; blocks: EmailBlock[] };

const HISTORY_LIMIT = 50;

function newId(type: EmailBlockType) {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${type}-${rnd}`;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function initBuilder(blocks: EmailBlock[]): BuilderState {
  return { blocks, selectedId: blocks[0]?.id ?? null, past: [], future: [], lastMutation: null };
}

function commit(state: BuilderState, blocks: EmailBlock[], coalesceKey: string | null): BuilderState {
  const coalesce = coalesceKey !== null && coalesceKey === state.lastMutation;
  return {
    ...state,
    blocks,
    past: coalesce ? state.past : [...state.past, state.blocks].slice(-HISTORY_LIMIT),
    future: [],
    lastMutation: coalesceKey,
  };
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case "insert": {
      const block = newEmailBlock(action.blockType);
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
      const copy: EmailBlock = { id: newId(src.type), type: src.type, props: structuredClone(src.props) };
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
    case "patch": {
      if (!state.blocks.some((b) => b.id === action.id)) return state;
      const blocks = state.blocks.map((b) =>
        b.id === action.id ? { ...b, props: { ...b.props, ...action.patch } } : b,
      );
      return commit(state, blocks, `patch:${action.id}:${Object.keys(action.patch).join(",")}`);
    }
    case "select":
      return state.selectedId === action.id ? state : { ...state, selectedId: action.id, lastMutation: null };
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
      return initBuilder(action.blocks);
    default:
      return state;
  }
}

/** dnd-kit drag result → a reducer action (reorder only; palette adds via click). */
export function resolveReorder(
  blocks: EmailBlock[],
  activeId: string,
  overId: string | null | undefined,
): BuilderAction | null {
  if (!overId || overId === activeId) return null;
  const from = blocks.findIndex((b) => b.id === activeId);
  const to = blocks.findIndex((b) => b.id === overId);
  if (from === -1 || to === -1 || from === to) return null;
  return { type: "move", from, to };
}
