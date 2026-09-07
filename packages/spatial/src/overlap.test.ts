import { expect, test } from "vitest";
import { aabbGap, aabbOverlaps, expandAabb, onGroundPlane, unionAabb } from "./aabb.js";

test("overlap and gap", () => {
  const a = { min: [0, 0, 0], max: [1, 1, 1] };
  const touching = { min: [1, 0, 0], max: [2, 1, 1] };
  const separated = { min: [3, 0, 0], max: [4, 1, 1] };
  const nested = { min: [0.25, 0.25, 0.25], max: [0.75, 0.75, 0.75] };
  expect(aabbOverlaps(a, touching)).toBe(true);
  expect(aabbGap(a, touching)).toBe(0);
  expect(aabbOverlaps(a, separated)).toBe(false);
  expect(aabbGap(a, separated)).toBe(2);
  expect(aabbOverlaps(a, nested)).toBe(true);
  expect(aabbGap(a, nested)).toBe(0);
  expect(onGroundPlane(a)).toBe(true);
  expect(onGroundPlane({ min: [0, 0.5, 0], max: [1, 1.5, 1] })).toBe(false);
  const united = unionAabb(a, separated);
  expect(united).toEqual({ min: [0, 0, 0], max: [4, 1, 1] });
  expect(expandAabb(a, 1)).toEqual({ min: [-1, -1, -1], max: [2, 2, 2] });
  expect(expandAabb(a, -8)).toEqual(a);
});
