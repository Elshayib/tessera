import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { runCli } from "./validate.js";

const campfire = fileURLToPath(
  new URL("../../../packages/schema/fixtures/documents/0.1.0/campfire.json", import.meta.url),
);
const invalid = fileURLToPath(new URL("../fixtures/invalid.json", import.meta.url));
const missing = fileURLToPath(new URL("../fixtures/missing.json", import.meta.url));

test("export gltf campfire exit 0", async () => {
  const out = mkdtempSync(join(tmpdir(), "tessera-export-"));
  const result = await runCli(["export", "gltf", campfire, "--out", out]);
  expect(result.exitCode).toBe(0);
  const names = readdirSync(out);
  expect(names.includes("campfire.glb")).toBe(true);
  expect(names.includes("campfire.tessera.json")).toBe(true);
});

test("INV-ARCH-06 cli still no three", async () => {
  const sources = import.meta.glob("./*.ts", { eager: true, query: "?raw", import: "default" });
  for (const [path, source] of Object.entries(sources)) {
    if (path.includes(".test.")) {
      continue;
    }
    expect(typeof source).toBe("string");
    if (typeof source !== "string") {
      continue;
    }
    expect(source.includes('from "three"'), path).toBe(false);
    expect(source.includes("from 'three'"), path).toBe(false);
    expect(source.includes("node_modules/three"), path).toBe(false);
  }
});

test("export missing file exit 1", async () => {
  const out = mkdtempSync(join(tmpdir(), "tessera-export-"));
  const result = await runCli(["export", "gltf", missing, "--out", out]);
  expect(result.exitCode).toBe(1);
});

test("export usage without --out exit 1", async () => {
  const result = await runCli(["export", "gltf", campfire]);
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("usage: tessera export gltf");
});

test("export unknown target exit 1", async () => {
  const out = mkdtempSync(join(tmpdir(), "tessera-export-"));
  const result = await runCli(["export", "code-three", campfire, "--out", out]);
  expect(result.exitCode).toBe(1);
});

test("export invalid document exit 2", async () => {
  const out = mkdtempSync(join(tmpdir(), "tessera-export-"));
  const result = await runCli(["export", "gltf", invalid, "--out", out]);
  expect(result.exitCode).toBe(2);
});
