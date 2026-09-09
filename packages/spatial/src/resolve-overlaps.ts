import type { Aabb, Vec3 } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import { aabbOverlaps } from "./aabb.js";

const DEFAULT_ITERATIONS = 8;

type MutableBox = {
  min: [number, number, number];
  max: [number, number, number];
};

/**
 * Minimal XZ translations that separate overlapping AABBs (`04` §8.5).
 *
 * @example
 * ```ts
 * resolveOverlaps([{ min: [0, 0, 0], max: [2, 1, 2] }, { min: [1, 0, 0], max: [3, 1, 2] }]);
 * ```
 *
 * @public
 */
export function resolveOverlaps(
  boxes: readonly Aabb[],
  iterations = DEFAULT_ITERATIONS,
): Result<readonly Vec3[], TesseraError> {
  if (boxes.length === 0) {
    return err(tesseraError("INVALID_INPUT", "resolveOverlaps requires targets"));
  }
  const rounds = Math.max(1, iterations);
  const current: MutableBox[] = boxes.map((box) => ({
    min: [box.min[0], box.min[1], box.min[2]],
    max: [box.max[0], box.max[1], box.max[2]],
  }));
  const dx = boxes.map(() => 0);
  const dz = boxes.map(() => 0);
  for (let round = 0; round < rounds; round += 1) {
    let moved = false;
    for (let i = 0; i < current.length; i += 1) {
      for (let j = i + 1; j < current.length; j += 1) {
        const left = current[i];
        const right = current[j];
        if (left === undefined || right === undefined || !aabbOverlaps(left, right)) {
          continue;
        }
        const overlapX = Math.min(left.max[0], right.max[0]) - Math.max(left.min[0], right.min[0]);
        const overlapZ = Math.min(left.max[2], right.max[2]) - Math.max(left.min[2], right.min[2]);
        const leftDx = dx[i];
        const rightDx = dx[j];
        const leftDz = dz[i];
        const rightDz = dz[j];
        if (
          leftDx === undefined ||
          rightDx === undefined ||
          leftDz === undefined ||
          rightDz === undefined
        ) {
          continue;
        }
        if (overlapX <= overlapZ) {
          const push = overlapX / 2;
          translateXz(left, -push, 0);
          translateXz(right, push, 0);
          dx[i] = leftDx - push;
          dx[j] = rightDx + push;
        } else {
          const push = overlapZ / 2;
          translateXz(left, 0, -push);
          translateXz(right, 0, push);
          dz[i] = leftDz - push;
          dz[j] = rightDz + push;
        }
        moved = true;
      }
    }
    if (!moved) {
      break;
    }
  }
  return ok(dx.map((x, index) => [x, 0, dz[index] ?? 0]));
}

function translateXz(box: MutableBox, deltaX: number, deltaZ: number): void {
  box.min[0] += deltaX;
  box.max[0] += deltaX;
  box.min[2] += deltaZ;
  box.max[2] += deltaZ;
}
