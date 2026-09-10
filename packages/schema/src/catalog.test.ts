import { expect, test } from "vitest";
import { COMMAND_CATALOG, ENGINE_QUERY_NAMES, QUERY_CATALOG } from "./catalog.js";

const SPEC_COMMAND_NAMES = [
  "entity.create",
  "entity.delete",
  "entity.duplicate",
  "entity.rename",
  "entity.setParent",
  "entity.reorder",
  "entity.setEnabled",
  "component.add",
  "component.remove",
  "component.set",
  "transform.set",
  "transform.translate",
  "transform.rotate",
  "transform.scale",
  "tags.add",
  "tags.remove",
  "metadata.set",
  "asset.create",
  "asset.update",
  "asset.delete",
  "material.create",
  "material.set",
  "material.assign",
  "asset.import",
  "environment.set",
  "settings.set",
  "camera.setMain",
  "layout.placeOn",
  "layout.snapToGround",
  "layout.alignTo",
  "layout.distribute",
  "layout.arrangeGrid",
  "layout.scatter",
  "layout.lookAt",
  "layout.resolveOverlaps",
  "camera.fit",
] as const;

const SPEC_QUERY_NAMES = [
  "entity.get",
  "entity.children",
  "scene.describe",
  "scene.find",
  "scene.stats",
  "scene.measure",
  "asset.get",
  "asset.list",
  "history.list",
] as const;

test("INV-CMD-10 catalog names match spec lists", () => {
  expect(COMMAND_CATALOG.map((command) => command.name)).toEqual([...SPEC_COMMAND_NAMES]);
  expect(QUERY_CATALOG.map((query) => query.name)).toEqual([...SPEC_QUERY_NAMES]);
  expect([...ENGINE_QUERY_NAMES]).toEqual(["view.screenshot", "scene.raycast", "view.getCamera"]);
  expect(new Set(COMMAND_CATALOG.map((command) => command.name)).size).toBe(COMMAND_CATALOG.length);
  expect(new Set(QUERY_CATALOG.map((query) => query.name)).size).toBe(QUERY_CATALOG.length);
  for (const command of COMMAND_CATALOG) {
    expect(command.description.length).toBeGreaterThan(0);
    expect(command.tier).toBeGreaterThanOrEqual(1);
    expect(command.tier).toBeLessThanOrEqual(4);
    expect(command.input.safeParse(null).success).toBe(false);
    expect(command.output).toBeDefined();
    expect(command.tags.includes("mutating")).toBe(true);
  }
  const assetImport = COMMAND_CATALOG.find((command) => command.name === "asset.import");
  expect(assetImport?.tier).toBe(3);
  expect(assetImport?.tags.includes("job")).toBe(true);
  const macros = COMMAND_CATALOG.filter((command) => command.tags.includes("macro"));
  expect(macros.map((command) => command.name)).toEqual([
    "layout.placeOn",
    "layout.snapToGround",
    "layout.alignTo",
    "layout.distribute",
    "layout.arrangeGrid",
    "layout.scatter",
    "layout.lookAt",
    "layout.resolveOverlaps",
    "camera.fit",
  ]);
  for (const command of macros) {
    expect(command.tier).toBe(2);
  }
  for (const query of QUERY_CATALOG) {
    expect(query.description.length).toBeGreaterThan(0);
    expect(query.input).toBeDefined();
    expect(query.output).toBeDefined();
    expect(query.tags.includes("engine")).toBe(false);
  }
});
