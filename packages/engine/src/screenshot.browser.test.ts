import { BoxGeometry, Color, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from "three";
import { expect, test } from "vitest";
import { captureScreenshot } from "./screenshot.js";

const POSE = { position: [0, 0, 5] as const, target: [0, 0, 0] as const };

test("INV-RND-07 helpers excluded by default", async () => {
  const { scene, camera, helper } = sceneWithHelper();
  const seen: string[] = [];
  const result = await captureScreenshot({
    scene,
    camera,
    pose: POSE,
    width: 64,
    height: 32,
    render: (captured) => {
      captured.traverse((object) => {
        const role = object.userData["role"];
        if (object.visible && typeof role === "string") {
          seen.push(role);
        }
      });
      return new Blob([new Uint8Array(8)], { type: "image/png" });
    },
  });
  expect(result.ok).toBe(true);
  expect(seen).toEqual(["content"]);
  expect(helper.visible).toBe(true);
});

test("includeHelpers includes layer 1 objects", async () => {
  const { scene, camera } = sceneWithHelper();
  const seen: string[] = [];
  const result = await captureScreenshot({
    scene,
    camera,
    pose: POSE,
    width: 64,
    height: 32,
    includeHelpers: true,
    render: (captured) => {
      captured.traverse((object) => {
        const role = object.userData["role"];
        if (object.visible && typeof role === "string") {
          seen.push(role);
        }
      });
      return new Blob([new Uint8Array(8)], { type: "image/png" });
    },
  });
  expect(result.ok).toBe(true);
  expect(seen.includes("helper")).toBe(true);
  expect(seen.includes("content")).toBe(true);
});

test("screenshot size", async () => {
  const { scene, camera } = sceneWithHelper();
  const okShot = await captureScreenshot({
    scene,
    camera,
    pose: POSE,
    width: 128,
    height: 64,
    format: "jpeg",
    render: () => new Blob([new Uint8Array(4)], { type: "image/jpeg" }),
  });
  expect(okShot.ok).toBe(true);
  if (!okShot.ok) {
    return;
  }
  expect(okShot.value.width).toBe(128);
  expect(okShot.value.height).toBe(64);
  expect(okShot.value.blob.type).toBe("image/jpeg");
  const tooWide = await captureScreenshot({
    scene,
    camera,
    pose: POSE,
    width: 2049,
    height: 64,
    render: () => new Blob([new Uint8Array(4)], { type: "image/png" }),
  });
  expect(tooWide.ok).toBe(false);
  if (tooWide.ok) {
    return;
  }
  expect(tooWide.error.code).toBe("INVALID_INPUT");
});

function sceneWithHelper() {
  const scene = new Scene();
  scene.background = new Color("#222222");
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  const content = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  content.userData["role"] = "content";
  content.layers.set(0);
  const helper = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  helper.userData["role"] = "helper";
  helper.layers.set(1);
  scene.add(content);
  scene.add(helper);
  return { scene, camera, helper };
}
