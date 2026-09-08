import { MaterialAssetSchema } from "@tessera/schema";
import { expect, test } from "vitest";
import { createDefaultMaterial } from "./default-material.js";

test("default material validates", () => {
  const material = createDefaultMaterial({
    id: "a_aaaaaaaaaa",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  const parsed = MaterialAssetSchema.safeParse(material);
  expect(parsed.success).toBe(true);
  expect(material.kind).toBe("material");
  expect(material.model).toBe("pbr");
  expect(material.license).toBe("unknown");
  expect(material.baseColor).toBe("#cccccc");
});
