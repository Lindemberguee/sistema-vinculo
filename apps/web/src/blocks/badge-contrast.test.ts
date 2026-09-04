import { describe, it, expect } from "vitest";
import { contrast } from "./accent";

/**
 * Regression guard for the light-mode badge pills (globals.css `.badge-success`
 * / `.badge-warn`). The 11px label needs extra margin over the icon-size 4.5:1
 * bar — `success-text`/`warn-text` are deliberately darker than `success`/`warn`.
 */
describe("light badge contrast", () => {
  it("badge-success text clears 4.5:1 on success-bg", () => {
    expect(contrast("#0f6b43", "#e8f5ee")).toBeGreaterThanOrEqual(4.5);
  });
  it("badge-warn text clears 4.5:1 on warn-bg", () => {
    expect(contrast("#7a5606", "#fdf3dc")).toBeGreaterThanOrEqual(4.5);
  });
  it("badge-danger and badge-info already clear the bar unchanged", () => {
    expect(contrast("#b3261e", "#fdeceb")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#1f5f8b", "#e7f0f7")).toBeGreaterThanOrEqual(4.5);
  });
});
