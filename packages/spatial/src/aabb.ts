import type { Aabb } from "@tessera/schema";

/**
 * True when two AABBs intersect or touch.
 *
 * @example
 * ```ts
 * aabbOverlaps({ min: [0, 0, 0], max: [1, 1, 1] }, { min: [1, 0, 0], max: [2, 1, 1] });
 * ```
 *
 * @public
 */
export function aabbOverlaps(a: Aabb, b: Aabb): boolean {
  return (
    a.min[0] <= b.max[0] &&
    a.max[0] >= b.min[0] &&
    a.min[1] <= b.max[1] &&
    a.max[1] >= b.min[1] &&
    a.min[2] <= b.max[2] &&
    a.max[2] >= b.min[2]
  );
}

/**
 * Euclidean gap between two AABBs (0 when they overlap or touch).
 *
 * @public
 */
export function aabbGap(a: Aabb, b: Aabb): number {
  const dx = Math.max(0, a.min[0] - b.max[0], b.min[0] - a.max[0]);
  const dy = Math.max(0, a.min[1] - b.max[1], b.min[1] - a.max[1]);
  const dz = Math.max(0, a.min[2] - b.max[2], b.min[2] - a.max[2]);
  return Math.hypot(dx, dy, dz);
}

/**
 * True when the AABB rests on the Y=0 ground plane (Q-0038).
 *
 * @public
 */
export function onGroundPlane(aabb: Aabb, epsilon = 1e-6): boolean {
  return Math.abs(aabb.min[1]) <= epsilon;
}

/**
 * Union of two AABBs.
 *
 * @public
 */
export function unionAabb(a: Aabb, b: Aabb): Aabb {
  return {
    min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
    max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
  };
}

/**
 * Expand an AABB by `padding` meters on every side (negative padding is clamped to 0).
 *
 * @public
 */
export function expandAabb(box: Aabb, padding: number): Aabb {
  const extra = Math.max(0, padding);
  return {
    min: [box.min[0] - extra, box.min[1] - extra, box.min[2] - extra],
    max: [box.max[0] + extra, box.max[1] + extra, box.max[2] + extra],
  };
}

/**
 * Space diagonal of an AABB.
 *
 * @public
 */
export function aabbDiagonal(box: Aabb): number {
  return Math.hypot(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]);
}
