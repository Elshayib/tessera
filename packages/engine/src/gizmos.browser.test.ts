import { Emitter } from "@tessera/std";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from "three";
import { expect, test } from "vitest";
import { createGizmoController } from "./gizmos.js";
import type { EngineEvents, EngineIntent } from "./types.js";

test("INV-RND-04 drag emits one intent batch", () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  const group = entity("e_box0000001", "Crate");
  scene.add(group);
  scene.updateMatrixWorld(true);
  const events = new Emitter<EngineEvents>();
  const intents: EngineIntent[] = [];
  events.on("intent", (intent) => {
    intents.push(intent);
  });
  const gizmo = createGizmoController({
    scene,
    camera,
    domElement: document.createElement("div"),
    events,
  });
  gizmo.setMode("translate", "world");
  gizmo.setSnapping({ enabled: true, translate: 0.1, rotateDeg: 15, scale: 0.1 });
  gizmo.setSelection([group]);
  gizmo.setDragging(true);
  group.position.set(1.5, 0, 0);
  gizmo.setDragging(true);
  expect(intents.length).toBe(0);
  gizmo.setDragging(false);
  expect(intents.length).toBe(1);
  const intent = intents[0];
  expect(intent?.kind).toBe("transform.set");
  if (intent?.kind !== "transform.set") {
    return;
  }
  expect(intent.targets.length).toBe(1);
  expect(intent.targets[0]?.id).toBe("e_box0000001");
  expect(intent.targets[0]?.transform.position[0]).toBe(1.5);
  expect(intent.label).toBe("Move Crate");
  gizmo.dispose();
});

test("escape during drag restores Object3D snapshot", () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  const group = entity("e_box0000002", "Crate");
  scene.add(group);
  const events = new Emitter<EngineEvents>();
  const intents: EngineIntent[] = [];
  events.on("intent", (intent) => {
    intents.push(intent);
  });
  const gizmo = createGizmoController({
    scene,
    camera,
    domElement: document.createElement("div"),
    events,
  });
  gizmo.setSelection([group]);
  gizmo.setDragging(true);
  group.position.set(4, 0, 0);
  gizmo.cancelDrag();
  expect(group.position.x).toBe(0);
  expect(intents.length).toBe(0);
  gizmo.dispose();
});

function entity(id: string, name: string): Group {
  const group = new Group();
  group.userData["entityId"] = id;
  group.userData["name"] = name;
  group.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()));
  return group;
}
