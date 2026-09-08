import { expect, test } from "vitest";
import {
  assetCreateCommand,
  assetDeleteCommand,
  assetImportCommand,
  assetUpdateCommand,
} from "./asset.js";

const ASSET = "a_aaaaaaaaaa";

test("asset command inputs reject invalid payloads", () => {
  expect(assetCreateCommand.input.safeParse({ asset: { kind: "geometry" } }).success).toBe(false);
  expect(assetUpdateCommand.input.safeParse({ target: "nope", patch: {} }).success).toBe(false);
  expect(assetDeleteCommand.input.safeParse({ target: ASSET, force: "yes" }).success).toBe(false);
  expect(assetImportCommand.input.safeParse({ blob: { fileName: "x" } }).success).toBe(false);
  expect(
    assetImportCommand.input.safeParse({ blob: { fileName: "x.glb", bytesRef: "mem:1" } }).success,
  ).toBe(true);
  expect(assetDeleteCommand.input.safeParse({ target: ASSET }).success).toBe(true);
});
