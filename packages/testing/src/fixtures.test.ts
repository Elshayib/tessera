import { validateDocument } from "@tessera/schema";
import { expect, test } from "vitest";
import { fixtures } from "./index.js";

test("D1 is deterministic and valid", () => {
  const first = fixtures.D1();
  const second = fixtures.D1();
  expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  expect(Object.keys(first.entities).length).toBeGreaterThanOrEqual(10_000);
  expect(Object.keys(first.assets).length).toBeGreaterThanOrEqual(2_000);
  for (const asset of Object.values(first.assets)) {
    expect(asset.kind).toBe("geometry");
    if (asset.kind === "geometry") {
      expect(asset.source.kind).toBe("primitive");
    }
  }
  const report = validateDocument(first);
  expect(report.ok).toBe(true);
  expect(report.issues).toEqual([]);
}, 60_000);
