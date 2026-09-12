import { FakeAssetSource } from "@tessera/testing";
import { expect, test } from "vitest";
import { createAssetSourceRegistry, requireSource } from "./registry.js";

test("search missing source → NOT_FOUND", () => {
  const registry = createAssetSourceRegistry();
  const missing = requireSource(registry, "polyhaven");
  expect(missing.ok).toBe(false);
  if (missing.ok) {
    return;
  }
  expect(missing.error.code).toBe("NOT_FOUND");
});

test("register then get", () => {
  const fake = new FakeAssetSource();
  const registry = createAssetSourceRegistry([fake]);
  expect(registry.get("fake-source")).toBe(fake);
  expect(registry.list()).toHaveLength(1);
});
