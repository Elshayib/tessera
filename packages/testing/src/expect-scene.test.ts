import type { Document, Entity } from "@tessera/schema";
import { expect, test } from "vitest";
import { docBuilder } from "./doc-builder.js";
import { expectScene } from "./expect-scene.js";

function withEntity(doc: Document, entity: Entity, mainCamera?: string): Document {
  return {
    ...doc,
    settings: mainCamera === undefined ? doc.settings : { ...doc.settings, mainCamera },
    entities: { ...doc.entities, [entity.id]: entity },
  };
}

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

test("expectScene light temperature, facing, glob, and camera", () => {
  const doc = docBuilder()
    .geometry("box", { type: "box", size: [1, 1, 1] })
    .material("red", { baseColor: "#ff0000", roughness: 0.7, metallic: 0.2 })
    .entity("looker", { mesh: "box", transform: { position: [0, 0.5, 0], rotation: [0, 0, 0] } })
    .entity("target", { mesh: "box", transform: { position: [0, 0.5, -3] } })
    .entity("child", { parent: "looker", mesh: "box", material: "red" })
    .build();
  expect(expectScene(doc).toHaveEntity("looker/child").pass).toBe(true);
  expect(expectScene(doc).toHaveEntity("look?r").pass).toBe(true);
  expect(expectScene(doc).toFace("looker", "target", 15).pass).toBe(true);
  expect(expectScene(doc).toFace("missing", "target", 15).pass).toBe(false);
  expect(
    expectScene(doc).toHaveMaterial("child", {
      metallicBetween: [0, 0.5],
      roughnessBetween: [0.5, 1],
    }).pass,
  ).toBe(true);
  expect(expectScene(doc).toHaveMaterial("missing", { baseColorNear: "#ff0000" }).pass).toBe(false);
  expect(expectScene(doc).toHaveMaterial("child", { baseColorNear: "red" }).pass).toBe(false);
  expect(
    expectScene(doc).toHaveTransactionsOnlyBy("user", [{ author: { kind: "agent" } }]).pass,
  ).toBe(false);
  expect(expectScene(doc).toHaveNoIssues(() => ({ issues: ["x"] })).pass).toBe(false);
  expect(expectScene(doc).toBeWithin("looker", "missing", 1).pass).toBe(false);
  expect(expectScene(doc).toNotOverlap(["looker", "missing"]).pass).toBe(false);

  const warm: Entity = {
    id: "e_light00000",
    name: "sun",
    parent: null,
    order: "light00000",
    enabled: true,
    components: {
      transform: { position: [0, 4, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      light: { type: "directional", color: "#ffaa44", intensity: 3, castShadow: true },
    },
  };
  const cool: Entity = {
    id: "e_light00001",
    name: "sky",
    parent: null,
    order: "light00001",
    enabled: true,
    components: {
      transform: { position: [0, 5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      light: { type: "point", color: "#88aaff", intensity: 80, range: 0, castShadow: false },
    },
  };
  const lit = withEntity(withEntity(doc, warm), cool);
  expect(expectScene(lit).toHaveLight("sun", { type: "directional" }).pass).toBe(true);
  expect(expectScene(lit).toHaveLight("sun", { colorTemperatureBetween: [2000, 8000] }).pass).toBe(
    true,
  );
  expect(expectScene(lit).toHaveLight("sky", { intensityBetween: [50, 120] }).pass).toBe(true);
  expect(expectScene(lit).toHaveLight("sky", { type: "directional" }).pass).toBe(false);
  expect(expectScene(lit).toHaveLight("sun", { intensityBetween: [0, 1] }).pass).toBe(false);

  const camera: Entity = {
    id: "e_camera0000",
    name: "main",
    parent: null,
    order: "camera0000",
    enabled: true,
    components: {
      transform: { position: [5, 5, 5], rotation: [0, 0, 0], scale: [1, 1, 1] },
      camera: { type: "perspective", fov: 50, near: 0.1, far: 100, orthoSize: 5 },
    },
  };
  const framed = withEntity(doc, camera, "e_camera0000");
  expect(expectScene(framed).toHaveMainCamera({ framesAll: true }).pass).toBe(true);
  const missingCam = withEntity(doc, camera, "e_missing000");
  expect(expectScene(missingCam).toHaveMainCamera({ framesAll: true }).pass).toBe(false);
});
