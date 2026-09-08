import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

test("runbook exists and names Godot and Blender", () => {
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    "../docs/runbooks/phase-1-export-check.md",
  );
  const text = readFileSync(path, "utf8");
  expect(text.includes("Godot")).toBe(true);
  expect(text.includes("Blender")).toBe(true);
  expect(text.includes("pnpm tessera export gltf")).toBe(true);
  expect(text.includes("campfire.json")).toBe(true);
  expect(text.includes("m1-composition-editor")).toBe(true);
});
