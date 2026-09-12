import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { HF_TRELLIS2_ROOT } from "./create-hf-trellis2-provider.js";
import { MESHY_API_ROOT } from "./create-meshy-provider.js";
import { RODIN_API_ROOT } from "./create-rodin-provider.js";
import { TRIPO_API_ROOT } from "./create-tripo-provider.js";
import { PACKAGE_NAME } from "./index.js";

test("INV-PRV-01 only providers-generation hardcodes vendor URLs", () => {
  expect(PACKAGE_NAME).toBe("@tessera/providers-generation");
  expect(MESHY_API_ROOT.startsWith("https://api.meshy.ai")).toBe(true);
  expect(TRIPO_API_ROOT.includes("tripo")).toBe(true);
  expect(RODIN_API_ROOT.includes("hyper3d")).toBe(true);
  expect(HF_TRELLIS2_ROOT.includes("TRELLIS")).toBe(true);
  const generationTypes = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../generation/src/types.ts"),
    "utf8",
  );
  expect(generationTypes.includes("https://api.meshy")).toBe(false);
  const assetsService = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../assets/src/asset-service.ts"),
    "utf8",
  );
  expect(assetsService.includes("https://api.meshy")).toBe(false);
});

test("Dockerfile exists under bridges/generation-worker/", () => {
  const docker = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../bridges/generation-worker/Dockerfile",
  );
  expect(existsSync(docker)).toBe(true);
  const text = readFileSync(docker, "utf8");
  expect(text.toLowerCase().includes("trellis")).toBe(true);
});
