import type { CheckSceneReader } from "@tessera/spatial";
import { expect, test } from "vitest";
import { runSpatialVerification } from "./spatial.js";

test("runSpatialVerification delegates to checkScene", () => {
  const reader: CheckSceneReader = {
    getEntity: () => undefined,
    getAsset: () => undefined,
    parentChain: () => [],
    pathOf: () => undefined,
    entities: () => [],
  };
  expect(runSpatialVerification(reader, []).issues).toEqual([]);
});
