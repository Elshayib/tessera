import { expect, test } from "vitest";
import {
  composeTrs,
  decomposeTrs,
  identityMat4,
  invertMat4,
  keepWorldLocal,
  multiplyMat4,
  transformPoint,
} from "./math.js";

test("identity invert and compose/decompose round-trip", () => {
  const identity = identityMat4();
  const inverted = invertMat4(identity);
  expect(inverted !== undefined).toBe(true);
  if (inverted === undefined) {
    return;
  }
  for (let index = 0; index < 16; index += 1) {
    const left = inverted[index];
    const right = identity[index];
    expect(left !== undefined && right !== undefined).toBe(true);
    if (left === undefined || right === undefined) {
      return;
    }
    expect(Math.abs(left - right)).toBeLessThan(1e-10);
  }
  const composed = composeTrs([1, 2, 3], [0, 0, 0], [1, 1, 1]);
  const moved = transformPoint(composed, [0, 0, 0]);
  expect(moved[0]).toBeCloseTo(1);
  expect(moved[1]).toBeCloseTo(2);
  expect(moved[2]).toBeCloseTo(3);
  const decomposed = decomposeTrs(composed);
  expect(decomposed.position[0]).toBeCloseTo(1);
  expect(decomposed.position[1]).toBeCloseTo(2);
  expect(decomposed.position[2]).toBeCloseTo(3);
  const product = multiplyMat4(composed, identity);
  expect(product[12]).toBeCloseTo(1);
});

test("keepWorldLocal preserves world under a translated parent", () => {
  const world = composeTrs([1, 0, 0], [0, 0, 0], [1, 1, 1]);
  const parent = composeTrs([1, 0, 0], [0, 0, 0], [1, 1, 1]);
  const local = keepWorldLocal(world, parent);
  expect(local !== undefined).toBe(true);
  if (local === undefined) {
    return;
  }
  expect(Math.abs(local.position[0])).toBeLessThan(1e-6);
  expect(Math.abs(local.position[1])).toBeLessThan(1e-6);
  expect(Math.abs(local.position[2])).toBeLessThan(1e-6);
});

test("singular invert, gimbal lock, and keepWorldLocal failure", () => {
  const zero: ReturnType<typeof identityMat4> = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  expect(invertMat4(zero)).toBeUndefined();
  expect(keepWorldLocal(identityMat4(), zero)).toBeUndefined();
  const gimbal = composeTrs([0, 0, 0], [0, 90, 0], [1, 1, 1]);
  const decomposed = decomposeTrs(gimbal);
  expect(Number.isFinite(decomposed.rotation[0])).toBe(true);
  const collapsed = decomposeTrs(composeTrs([0, 0, 0], [0, 0, 0], [0, 0, 0]));
  expect(collapsed.scale[0]).toBe(0);
});
