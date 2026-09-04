import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/payments",
  "packages/blocks",
  "packages/shared",
]);
