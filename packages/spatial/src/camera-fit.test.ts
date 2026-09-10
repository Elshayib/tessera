import { expect, test } from "vitest";
import { cameraFitPose } from "./camera-fit.js";
import { frameBounds } from "./frame-bounds.js";

test("cameraFitPose iso uses frameBounds position", () => {
  const framed = frameBounds([{ min: [0, 0, 0], max: [2, 2, 2] }], 0);
  expect(framed.ok).toBe(true);
  if (!framed.ok) {
    return;
  }
  const iso = cameraFitPose(framed.value, { position: [0, 0, 0], rotation: [0, 0, 0] }, "iso");
  expect(iso.position).toEqual(framed.value.position);
  const keep = cameraFitPose(framed.value, { position: [0, 0, 0], rotation: [0, 0, 0] }, "keep");
  expect(keep.rotation).toEqual([0, 0, 0]);
});
