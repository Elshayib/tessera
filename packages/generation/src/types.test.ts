import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { BUILTIN_GENERATION_PROVIDER_IDS } from "./index.js";
import type {
  GenerationProvider,
  GenerationProviderDescriptor,
  GenerationRequest,
  GenerationResult,
} from "./types.js";

function dependencyNames(pkg: unknown): readonly string[] {
  if (typeof pkg !== "object" || pkg === null) {
    return [];
  }
  const names: string[] = [];
  for (const [key, value] of Object.entries(pkg)) {
    if (key !== "dependencies" && key !== "devDependencies") {
      continue;
    }
    if (typeof value !== "object" || value === null) {
      continue;
    }
    names.push(...Object.keys(value));
  }
  return names;
}

test("INV-PRV-01 generation has no vendor SDK dependency", () => {
  const pkg = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8"),
  ) as unknown;
  const names = dependencyNames(pkg);
  expect(names.some((name) => name === "ai" || name.startsWith("@ai-sdk"))).toBe(false);
  expect(names.some((name) => name.includes("meshy") || name.includes("tripo"))).toBe(false);
  expect(names.some((name) => name.includes("hyper3d") || name.includes("gradio"))).toBe(false);
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "types.ts"), "utf8");
  expect(source.includes("https://api.meshy")).toBe(false);
  expect(source.includes("https://api.tripo")).toBe(false);
  expect(source.includes("hyper3d")).toBe(false);
});

test("GenerationRequest kinds match 07 §8", () => {
  const mesh: GenerationRequest = { kind: "mesh", pbr: true, style: "lowpoly" };
  const texture: GenerationRequest = {
    kind: "texture",
    prompt: "wood",
    resolution: 1024,
    maps: ["baseColor", "normal"],
  };
  const environment: GenerationRequest = {
    kind: "environment",
    prompt: "forest",
    resolution: 2048,
  };
  const image: GenerationRequest = { kind: "image", prompt: "barrel", size: [256, 256] };
  expect(mesh.kind).toBe("mesh");
  expect(texture.maps).toContain("normal");
  expect(environment.resolution).toBe(2048);
  expect(image.size).toEqual([256, 256]);
  expect([...BUILTIN_GENERATION_PROVIDER_IDS]).toEqual([
    "meshy",
    "tripo",
    "rodin",
    "hf-trellis2",
    "local-worker",
  ]);
});

test("descriptor and result field names match 07 §8", () => {
  const descriptor: GenerationProviderDescriptor = {
    id: "local-worker",
    displayName: "Local",
    auth: "none",
    capabilities: {
      textToMesh: true,
      imageToMesh: true,
      textToTexture: true,
      meshToTexture: true,
      textToImage: true,
      textToEnvironment: true,
    },
    outputLicense: "CC0-1.0",
    typicalSeconds: { mesh: 30, texture: 10 },
    docsUrl: "https://example.invalid",
  };
  const result: GenerationResult = {
    kind: "mesh",
    blobs: [],
    license: "CC0-1.0",
    provenance: { source: "generated", importedAt: "2026-01-01T00:00:00.000Z" },
  };
  expect(descriptor.auth).toBe("none");
  expect(result.license).not.toBe("unknown");
  const _provider: GenerationProvider | undefined = undefined;
  expect(_provider).toBeUndefined();
});
