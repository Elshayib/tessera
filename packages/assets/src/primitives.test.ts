import type { Primitive } from "@tessera/schema";
import { primitiveBounds } from "@tessera/schema";
import { expect, test } from "vitest";
import { createPrimitiveMesh } from "./primitives.js";

const EPS = 1e-5;

test("box/sphere/plane vertex counts and bounds", () => {
  const box = createPrimitiveMesh({ type: "box", size: [2, 4, 6] });
  expect(box.positions.length / 3).toBe(24);
  expect(box.indices.length / 3).toBe(12);
  expectAabb(box.positions, primitiveBounds({ type: "box", size: [2, 4, 6] }));

  const sphere = createPrimitiveMesh({ type: "sphere", radius: 2, segments: 8 });
  expect(sphere.positions.length / 3).toBe(81);
  expect(sphere.indices.length / 3).toBe(128);
  expectAabb(sphere.positions, primitiveBounds({ type: "sphere", radius: 2, segments: 8 }));

  const plane = createPrimitiveMesh({ type: "plane", size: [4, 6] });
  expect(plane.positions.length / 3).toBe(4);
  expect(plane.indices.length / 3).toBe(2);
  expectAabb(plane.positions, primitiveBounds({ type: "plane", size: [4, 6] }));
});

test("every Primitive discriminant is a triangle mesh inside analytic bounds", () => {
  const primitives: readonly Primitive[] = [
    { type: "box", size: [1, 1, 1] },
    { type: "sphere", radius: 0.5, segments: 16 },
    { type: "cylinder", radiusTop: 1, radiusBottom: 2, height: 4, segments: 8 },
    { type: "cone", radius: 3, height: 2, segments: 8 },
    { type: "plane", size: [1, 1] },
    { type: "torus", radius: 2, tube: 0.5, radialSegments: 8, tubularSegments: 8 },
    { type: "capsule", radius: 1, height: 4, segments: 8 },
  ];
  for (const primitive of primitives) {
    const mesh = createPrimitiveMesh(primitive);
    expect(mesh.indices.length % 3).toBe(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.positions.length).toBe(mesh.normals.length);
    expect(mesh.uvs.length).toBe((mesh.positions.length / 3) * 2);
    expectAabb(mesh.positions, primitiveBounds(primitive));
  }
});

function expectAabb(
  positions: Float32Array,
  expected: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  },
): void {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (x === undefined || y === undefined || z === undefined) {
      continue;
    }
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  expect(minX).toBeCloseTo(expected.min[0], 4);
  expect(minY).toBeCloseTo(expected.min[1], 4);
  expect(minZ).toBeCloseTo(expected.min[2], 4);
  expect(maxX).toBeCloseTo(expected.max[0], 4);
  expect(maxY).toBeCloseTo(expected.max[1], 4);
  expect(maxZ).toBeCloseTo(expected.max[2], 4);
  expect(Math.abs(minX - expected.min[0])).toBeLessThanOrEqual(EPS);
  expect(Math.abs(minY - expected.min[1])).toBeLessThanOrEqual(EPS);
  expect(Math.abs(minZ - expected.min[2])).toBeLessThanOrEqual(EPS);
  expect(Math.abs(maxX - expected.max[0])).toBeLessThanOrEqual(EPS);
  expect(Math.abs(maxY - expected.max[1])).toBeLessThanOrEqual(EPS);
  expect(Math.abs(maxZ - expected.max[2])).toBeLessThanOrEqual(EPS);
}
