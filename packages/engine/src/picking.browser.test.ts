import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from "three";
import { expect, test } from "vitest";
import { pick, raycast } from "./picking.js";

const NEAR = "e_near000001";
const FAR = "e_far0000001";
const DISABLED = "e_disa000001";
const HELPER = "e_help000001";

test("pick nearest enabled entity", () => {
  const { scene, camera } = layout();
  const hit = pick({
    scene,
    camera,
    x: 50,
    y: 50,
    width: 100,
    height: 100,
  });
  expect(hit?.entityId).toBe(NEAR);
  expect(hit !== null && hit.distance > 0).toBe(true);
});

test("pick ignores disabled entities and helper layers unless requested", () => {
  const { scene, camera } = layout();
  const ignored = pick({
    scene,
    camera,
    x: 50,
    y: 50,
    width: 100,
    height: 100,
  });
  expect(ignored?.entityId).toBe(NEAR);
  const withHelpers = pick({
    scene,
    camera,
    x: 50,
    y: 50,
    width: 100,
    height: 100,
    includeHelperLayers: true,
  });
  expect(withHelpers?.entityId).toBe(HELPER);
});

test("raycast returns enabled hits in distance order", () => {
  const { scene } = layout();
  const hits = raycast({
    scene,
    origin: [0, 0, 5],
    direction: [0, 0, -1],
  });
  expect(hits.map((hit) => hit.entityId)).toEqual([NEAR, FAR]);
});

function layout() {
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  scene.add(entityGroup(NEAR, 0, 0));
  scene.add(entityGroup(FAR, 0, -3));
  const hidden = entityGroup(DISABLED, 0, 1);
  hidden.visible = false;
  scene.add(hidden);
  const helper = entityGroup(HELPER, 0, 2);
  helper.traverse((object) => {
    object.layers.set(1);
  });
  scene.add(helper);
  scene.updateMatrixWorld(true);
  return { scene, camera };
}

function entityGroup(id: string, y: number, z: number): Group {
  const group = new Group();
  group.userData["entityId"] = id;
  group.position.set(0, y, z);
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  mesh.layers.set(0);
  group.add(mesh);
  return group;
}
