import { Block, BLOCK_REGISTRY } from "@donation/blocks";
import { EDITOR_FIELDS } from "@/blocks/editor-fields";
import type { EditorBlock } from "./studio-reducer";

/**
 * Human-readable list of what's still missing on a block. Combines the block's
 * own required-field config with any Zod validation failure. Empty = ready.
 */
export function blockIssues(block: EditorBlock): string[] {
  const issues: string[] = [];
  const props = block.props as Record<string, unknown>;

  for (const f of EDITOR_FIELDS[block.type] ?? []) {
    if (!f.required) continue;
    const v = props[f.key];
    const empty = v == null || v === "" || (Array.isArray(v) && v.length === 0);
    if (empty) issues.push(f.label);
  }

  if (issues.length === 0) {
    const parsed = Block.safeParse(block);
    if (!parsed.success) {
      for (const i of parsed.error.issues) {
        const key = i.path[1];
        const field = EDITOR_FIELDS[block.type]?.find((f) => f.key === key);
        issues.push(field ? field.label : (i.message ?? "campo inválido"));
      }
    }
  }
  return [...new Set(issues)];
}

export function isBlockIncomplete(block: EditorBlock): boolean {
  return blockIssues(block).length > 0;
}

/** Blocks needing attention, with their label + missing fields. */
export function pendingBlocks(blocks: EditorBlock[]): { id: string; label: string; issues: string[] }[] {
  return blocks
    .map((b) => ({ id: b.id, label: BLOCK_REGISTRY[b.type].label, issues: blockIssues(b) }))
    .filter((x) => x.issues.length > 0);
}
