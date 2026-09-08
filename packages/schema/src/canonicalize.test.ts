import { expect, test } from "vitest";
import { canonicalize } from "./canonicalize.js";
import { emptyDocument } from "./defaults.js";

test("INV-DOC-08 canonicalize idempotent", () => {
  const first = canonicalize(emptyDocument());
  const parsed: unknown = JSON.parse(first);
  const second = canonicalize(parsed);
  expect(second).toBe(first);
  expect(first.endsWith("\n")).toBe(true);
  expect(first.includes("\r")).toBe(false);
});
