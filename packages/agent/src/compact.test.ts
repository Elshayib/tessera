import { expect, test } from "vitest";
import { compactValue, contextBudget, estimateTokens, fitMessages } from "./compact.js";

test("INV-AGT-07 request fits context window", () => {
  const budget = contextBudget(4000, 1000);
  expect(budget).toBe(2000);
  const oversized = {
    role: "user" as const,
    parts: [{ kind: "text" as const, text: "x".repeat(20_000) }],
  };
  const fitted = fitMessages([{ role: "system", content: "sys" }, oversized], budget);
  expect(estimateTokens(fitted)).toBeLessThanOrEqual(budget);
  const compacted = compactValue({ items: Array.from({ length: 60 }, (_, index) => index) });
  expect(compacted).toEqual({
    items: [...Array.from({ length: 50 }, (_, index) => index), "…+10 more"],
  });
});
