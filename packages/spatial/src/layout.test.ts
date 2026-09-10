import { expect, test } from "vitest";
import {
  aabbCenter,
  alignToDelta,
  arrangeGridPositions,
  distributeCenters,
  placeOnDelta,
  snapToGroundDelta,
} from "./layout.js";
import { poissonDisk } from "./poisson.js";

test("placeOnDelta rests on the surface top and keeps XZ on the top face", () => {
  const surface = { min: [0, 0, 0], max: [10, 2, 10] };
  const target = { min: [0, 5, 0], max: [2, 7, 2] };
  const delta = placeOnDelta(target, surface, { anchor: "center" });
  expect(target.min[1] + delta[1]).toBeCloseTo(2);
  expect(aabbCenter(target)[0] + delta[0]).toBeCloseTo(5);
  expect(aabbCenter(target)[2] + delta[2]).toBeCloseTo(5);
});

test("snapToGroundDelta moves along Y only", () => {
  const target = { min: [0, 4, 0], max: [1, 5, 1] };
  expect(snapToGroundDelta(target, 0)).toEqual([0, -4, 0]);
});

test("alignToDelta centers on X", () => {
  const target = { min: [0, 0, 0], max: [2, 1, 2] };
  const reference = { min: [10, 0, 0], max: [14, 1, 2] };
  const delta = alignToDelta(target, reference, ["x"], "center");
  expect(delta[0]).toBeCloseTo(11);
  expect(delta[1]).toBe(0);
});

test("distributeCenters even along X", () => {
  const next = distributeCenters(
    [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ],
    "x",
    "even",
    [0, 0, 0],
    [10, 0, 0],
  );
  expect(next[0]?.[0]).toBeCloseTo(0);
  expect(next[1]?.[0]).toBeCloseTo(5);
  expect(next[2]?.[0]).toBeCloseTo(10);
});

test("arrangeGridPositions fills xz in order", () => {
  const positions = arrangeGridPositions(4, 2, [3, 4], [1, 2, 3], "xz");
  expect(positions).toEqual([
    [1, 2, 3],
    [4, 2, 3],
    [1, 2, 7],
    [4, 2, 7],
  ]);
});

test("poissonDisk is deterministic for the same seed", () => {
  const a = poissonDisk([0, 0], [10, 10], 8, 42, 1);
  const b = poissonDisk([0, 0], [10, 10], 8, 42, 1);
  expect(a).toEqual(b);
  expect(a).toHaveLength(8);
});

test("placeOnDelta random without sampler stays centered; vec2 clamps", () => {
  const surface = { min: [0, 0, 0], max: [10, 2, 10] };
  const target = { min: [0, 5, 0], max: [2, 7, 2] };
  const noRng = placeOnDelta(target, surface, { anchor: "random" });
  expect(aabbCenter(target)[0] + noRng[0]).toBeCloseTo(5);
  const sampled = placeOnDelta(target, surface, { anchor: "random", random: () => 0 });
  expect(aabbCenter(target)[0] + sampled[0]).toBeCloseTo(0);
  const corner = placeOnDelta(target, surface, { anchor: [2, -1], margin: 1 });
  expect(aabbCenter(target)[0] + corner[0]).toBeCloseTo(9);
  expect(aabbCenter(target)[2] + corner[2]).toBeCloseTo(1);
});

test("alignToDelta min max y and z", () => {
  const target = { min: [0, 0, 0], max: [2, 2, 2] };
  const reference = { min: [4, 4, 4], max: [8, 8, 8] };
  expect(alignToDelta(target, reference, ["y"], "min")[1]).toBeCloseTo(4);
  expect(alignToDelta(target, reference, ["z"], "max")[2]).toBeCloseTo(6);
});

test("distributeCenters empty, single, numeric spacing, y axis", () => {
  expect(distributeCenters([], "x", "even")).toEqual([]);
  expect(distributeCenters([[3, 1, 2]], "y", undefined)).toEqual([[3, 1, 2]]);
  const spaced = distributeCenters(
    [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ],
    "z",
    4,
    [0, 0, 1],
    [0, 0, 9],
  );
  expect(spaced[0]?.[2]).toBeCloseTo(1);
  expect(spaced[1]?.[2]).toBeCloseTo(5);
  expect(spaced[2]?.[2]).toBeCloseTo(9);
});

test("arrangeGridPositions fills xy", () => {
  const positions = arrangeGridPositions(2, 2, [2, 3], [0, 0, 5], "xy");
  expect(positions).toEqual([
    [0, 0, 5],
    [2, 0, 5],
  ]);
});

test("poissonDisk fills remaining points when minDistance is too large", () => {
  const points = poissonDisk([0, 0], [0.1, 0.1], 6, 1, 10);
  expect(points).toHaveLength(6);
});
