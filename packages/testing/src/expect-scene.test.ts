import { expect, test } from "vitest";
import { docBuilder } from "./doc-builder.js";
import { expectScene } from "./expect-scene.js";

test("expectScene toHaveEntity / toBeOnGround", () => {
  const doc = docBuilder()
    .geometry("box", { type: "box", size: [1, 1, 1] })
    .entity("red_cube", { mesh: "box", transform: { position: [0, 0.5, 0] } })
    .build();
  expect(expectScene(doc).toHaveEntity("red_*").pass).toBe(true);
  expect(expectScene(doc).toHaveEntity("missing").pass).toBe(false);
  expect(expectScene(doc).toBeOnGround("red_cube", 0.01).pass).toBe(true);
});

test("expectScene count material light camera overlap", () => {
  const doc = docBuilder()
    .geometry("box", { type: "box", size: [1, 1, 1] })
    .material("red", { baseColor: "#ff0000", roughness: 0.7, metallic: 0 })
    .entity("cube_a", { mesh: "box", material: "red", transform: { position: [0, 0.5, 0] } })
    .entity("cube_b", { mesh: "box", transform: { position: [3, 0.5, 0] } })
    .build();
  expect(expectScene(doc).toHaveCount("cube_*", 2).pass).toBe(true);
  expect(
    expectScene(doc).toHaveMaterial("cube_a", {
      baseColorNear: "#ff0000",
      roughnessBetween: [0.5, 1],
    }).pass,
  ).toBe(true);
  expect(expectScene(doc).toNotOverlap(["cube_a", "cube_b"]).pass).toBe(true);
  expect(expectScene(doc).toBeWithin("cube_a", "cube_b", 4).pass).toBe(true);
  expect(expectScene(doc).toBeUnchanged(["cube_a"]).pass).toBe(false);
  expect(expectScene(doc, doc).toBeUnchanged(["cube_a"]).pass).toBe(true);
  expect(expectScene(doc).toHaveNoIssues(() => ({ issues: [] })).pass).toBe(true);
  expect(
    expectScene(doc).toHaveTransactionsOnlyBy("agent", [{ author: { kind: "agent" } }]).pass,
  ).toBe(true);
  expect(expectScene(doc).toHaveMainCamera({ framesAll: true }).pass).toBe(false);
});
