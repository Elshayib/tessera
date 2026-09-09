import { expect, test } from "vitest";
import { localNegZ, lookAtEuler } from "./look-at.js";
import { composeTrs, transformPoint } from "./math.js";

test("lookAtEuler faces local -Z at the point", () => {
  const from: [number, number, number] = [0, 2, 0];
  const to: [number, number, number] = [4, 2, 0];
  const rotation = lookAtEuler(from, to, [0, 1, 0]);
  const world = composeTrs(from, rotation, [1, 1, 1]);
  const tip = transformPoint(world, [0, 0, -1]);
  const forward: [number, number, number] = [tip[0] - from[0], tip[1] - from[1], tip[2] - from[2]];
  const len = Math.hypot(forward[0], forward[1], forward[2]);
  expect(len).toBeGreaterThan(0.5);
  const dir = [forward[0] / len, forward[1] / len, forward[2] / len];
  expect(dir[0]).toBeGreaterThan(0.99);
  expect(Math.abs(dir[1])).toBeLessThan(0.05);
  expect(Math.abs(dir[2])).toBeLessThan(0.05);
  const neg = localNegZ(rotation);
  expect(neg[0]).toBeGreaterThan(0.99);
});

test("lookAtEuler coincident points and parallel up stay finite", () => {
  const same = lookAtEuler([1, 2, 3], [1, 2, 3], [0, 1, 0]);
  expect(same.every((value) => Number.isFinite(value))).toBe(true);
  const alongUp = lookAtEuler([0, 0, 0], [0, 1, 0], [0, 1, 0]);
  expect(alongUp.every((value) => Number.isFinite(value))).toBe(true);
});
