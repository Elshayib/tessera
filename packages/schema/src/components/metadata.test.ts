import { expect, test } from "vitest";
import { MetadataSchema } from "./metadata.js";

test("metadata key count and size limits", () => {
  expect(MetadataSchema.parse({ note: "ok" })).toEqual({ note: "ok" });
  const tooMany: Record<string, string> = {};
  for (let i = 0; i < 65; i += 1) {
    tooMany[`k${String(i)}`] = "x";
  }
  expect(MetadataSchema.safeParse(tooMany).success).toBe(false);
  expect(MetadataSchema.safeParse({ blob: "x".repeat(20_000) }).success).toBe(false);
});
