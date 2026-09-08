import type { Aabb, Vec3 } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import { aabbDiagonal, expandAabb, unionAabb } from "./aabb.js";

const ISO_X = 1 / Math.sqrt(3);
const ISO_Y = 1 / Math.sqrt(3);
const ISO_Z = 1 / Math.sqrt(3);

/**
 * Camera framing input for engine `frame` (`05` §8). Pose fields are look-at
 * target plus an isometric camera position (Q-0036).
 *
 * @public
 */
export interface FrameBounds {
  readonly center: Vec3;
  readonly min: Vec3;
  readonly max: Vec3;
  readonly radius: number;
  readonly distance: number;
  readonly position: Vec3;
  readonly target: Vec3;
  readonly padding: number;
}

/**
 * Computes a look-at framing pose from world AABBs. `padding` is extra meters
 * on each side (Q-0039).
 *
 * @example
 * ```ts
 * const framed = frameBounds([{ min: [0, 0, 0], max: [2, 2, 2] }], 0.5);
 * ```
 *
 * @public
 */
export function frameBounds(
  targets: readonly Aabb[],
  padding = 0,
): Result<FrameBounds, TesseraError> {
  const first = targets[0];
  if (first === undefined) {
    return err(tesseraError("INVALID_INPUT", "frameBounds requires at least one AABB"));
  }
  const extra = Math.max(0, padding);
  let combined = first;
  for (let index = 1; index < targets.length; index += 1) {
    const next = targets[index];
    if (next !== undefined) {
      combined = unionAabb(combined, next);
    }
  }
  const padded = expandAabb(combined, extra);
  const center: Vec3 = [
    (padded.min[0] + padded.max[0]) / 2,
    (padded.min[1] + padded.max[1]) / 2,
    (padded.min[2] + padded.max[2]) / 2,
  ];
  const radius = aabbDiagonal(padded) / 2;
  const distance = radius * 2;
  const position: Vec3 = [
    center[0] + ISO_X * distance,
    center[1] + ISO_Y * distance,
    center[2] + ISO_Z * distance,
  ];
  return ok({
    center,
    min: padded.min,
    max: padded.max,
    radius,
    distance,
    position,
    target: center,
    padding: extra,
  });
}
