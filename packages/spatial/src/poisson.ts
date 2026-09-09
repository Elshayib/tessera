import type { Vec2 } from "@tessera/schema";
import { mulberry32 } from "./rng.js";

/**
 * Deterministic Poisson-disk samples on a rectangle in XZ (`04` §8.5 scatter).
 *
 * @public
 */
export function poissonDisk(
  min: Vec2,
  max: Vec2,
  count: number,
  seed: number,
  minDistance = 0,
): readonly Vec2[] {
  const rng = mulberry32(seed);
  const points: Vec2[] = [];
  const width = Math.max(0, max[0] - min[0]);
  const depth = Math.max(0, max[1] - min[1]);
  const needed = Math.max(0, count);
  const maxAttempts = Math.max(30, needed * 30);
  let attempts = 0;
  while (points.length < needed && attempts < maxAttempts) {
    attempts += 1;
    const candidate: Vec2 = [min[0] + rng() * width, min[1] + rng() * depth];
    if (minDistance > 0 && points.some((point) => hypot2(point, candidate) < minDistance)) {
      continue;
    }
    points.push(candidate);
  }
  while (points.length < needed) {
    points.push([min[0] + rng() * width, min[1] + rng() * depth]);
  }
  return points.slice(0, needed);
}

function hypot2(a: Vec2, b: Vec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
