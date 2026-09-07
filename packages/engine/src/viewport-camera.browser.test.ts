import { createDocument } from "@tessera/core";
import { emptyDocument } from "@tessera/schema";
import { frameBounds } from "@tessera/spatial";
import { isOk } from "@tessera/std";
import { FakeClock } from "@tessera/testing";
import { PerspectiveCamera } from "three";
import { expect, test } from "vitest";
import { createViewportCamera } from "./viewport-camera.js";

test("viewport camera is not in the document", () => {
  const { reader } = createDocument({ snapshot: emptyDocument() });
  const before = JSON.stringify(reader.snapshot());
  const viewport = createViewportCamera({
    camera: new PerspectiveCamera(50, 1, 0.1, 100),
    domElement: document.createElement("div"),
  });
  viewport.setPose({ position: [10, 8, 12], target: [1, 2, 3] });
  expect(JSON.stringify(reader.snapshot())).toBe(before);
  const pose = viewport.getPose();
  expect(pose.position[0]).toBeCloseTo(10, 5);
  expect(pose.position[1]).toBeCloseTo(8, 5);
  expect(pose.position[2]).toBeCloseTo(12, 5);
  expect(pose.target[0]).toBeCloseTo(1, 5);
  expect(pose.target[1]).toBeCloseTo(2, 5);
  expect(pose.target[2]).toBeCloseTo(3, 5);
  viewport.dispose();
});

test("frame uses spatial.frameBounds and skips animation when reduced motion", () => {
  const clock = new FakeClock();
  const viewport = createViewportCamera({
    camera: new PerspectiveCamera(50, 1, 0.1, 100),
    domElement: document.createElement("div"),
    clock,
    reducedMotion: () => true,
  });
  const boxes = [{ min: [0, 0, 0] as const, max: [2, 2, 2] as const }];
  const framed = frameBounds(boxes, 0.5);
  expect(isOk(framed)).toBe(true);
  if (!isOk(framed)) {
    return;
  }
  const result = viewport.frame(boxes, { padding: 0.5, animate: true });
  expect(result.ok).toBe(true);
  expect(viewport.getPose().position).toEqual(framed.value.position);
  expect(viewport.getPose().target).toEqual(framed.value.target);
  viewport.dispose();
});

test("frame animates 300 ms unless already at the posed target", () => {
  const clock = new FakeClock();
  const viewport = createViewportCamera({
    camera: new PerspectiveCamera(50, 1, 0.1, 100),
    domElement: document.createElement("div"),
    clock,
    reducedMotion: () => false,
  });
  viewport.setPose({ position: [0, 0, 10], target: [0, 0, 0] });
  const boxes = [{ min: [0, 0, 0] as const, max: [2, 2, 2] as const }];
  const framed = frameBounds(boxes, 0.5);
  expect(isOk(framed)).toBe(true);
  if (!isOk(framed)) {
    return;
  }
  const result = viewport.frame(boxes, { padding: 0.5, animate: true });
  expect(result.ok).toBe(true);
  expect(viewport.getPose().position[2]).toBe(10);
  clock.advance(300);
  viewport.update();
  expect(viewport.getPose().position[0]).toBeCloseTo(framed.value.position[0], 5);
  expect(viewport.getPose().position[1]).toBeCloseTo(framed.value.position[1], 5);
  expect(viewport.getPose().position[2]).toBeCloseTo(framed.value.position[2], 5);
  viewport.dispose();
});
