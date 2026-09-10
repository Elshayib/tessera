import type { Aabb } from "@tessera/schema";
import { expect, test } from "vitest";
import { resolveOverlaps } from "./resolve-overlaps.js";

test("resolveOverlaps separates XZ overlap within iterations", () => {
  const a: Aabb = { min: [0, 0, 0], max: [2, 1, 2] };
  const b: Aabb = { min: [1, 0, 0], max: [3, 1, 2] };
  const moved = resolveOverlaps([a, b], 8);
  expect(moved.ok).toBe(true);
  if (!moved.ok) {
    return;
  }
  const first = moved.value[0];
  const second = moved.value[1];
  expect(first).toBeDefined();
  expect(second).toBeDefined();
  if (first === undefined || second === undefined) {
    return;
  }
  const left: Aabb = {
    min: [a.min[0] + first[0], a.min[1], a.min[2] + first[2]],
    max: [a.max[0] + first[0], a.max[1], a.max[2] + first[2]],
  };
  const right: Aabb = {
    min: [b.min[0] + second[0], b.min[1], b.min[2] + second[2]],
    max: [b.max[0] + second[0], b.max[1], b.max[2] + second[2]],
  };
  const overlapX = Math.min(left.max[0], right.max[0]) - Math.max(left.min[0], right.min[0]);
  const overlapZ = Math.min(left.max[2], right.max[2]) - Math.max(left.min[2], right.min[2]);
  expect(overlapX <= 0 || overlapZ <= 0).toBe(true);
  expect(first[1]).toBe(0);
  expect(second[1]).toBe(0);
});

test("resolveOverlaps empty is INVALID_INPUT; Z overlap is separated", () => {
  const empty = resolveOverlaps([]);
  expect(empty.ok).toBe(false);
  const a: Aabb = { min: [0, 0, 0], max: [4, 1, 4] };
  const b: Aabb = { min: [1, 0, 3], max: [5, 1, 5] };
  const moved = resolveOverlaps([a, b], 8);
  expect(moved.ok).toBe(true);
  if (!moved.ok) {
    return;
  }
  expect((moved.value[0]?.[2] ?? 0) !== 0 || (moved.value[1]?.[2] ?? 0) !== 0).toBe(true);
});
