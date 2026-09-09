import type { Aabb, Vec2, Vec3 } from "@tessera/schema";

export type PlaceAnchor = "center" | "random" | Vec2;

/**
 * World translation that rests `target` on `surface` top (`04` §8.5).
 *
 * @public
 */
export function placeOnDelta(
  target: Aabb,
  surface: Aabb,
  options: {
    readonly anchor?: PlaceAnchor;
    readonly margin?: number;
    readonly random?: () => number;
  } = {},
): Vec3 {
  const margin = Math.max(0, options.margin ?? 0);
  const usableMinX = surface.min[0] + margin;
  const usableMaxX = surface.max[0] - margin;
  const usableMinZ = surface.min[2] + margin;
  const usableMaxZ = surface.max[2] - margin;
  const width = Math.max(0, usableMaxX - usableMinX);
  const depth = Math.max(0, usableMaxZ - usableMinZ);
  let u = 0.5;
  let v = 0.5;
  const anchor = options.anchor ?? "center";
  if (anchor === "random") {
    const sample = options.random;
    u = sample === undefined ? 0.5 : sample();
    v = sample === undefined ? 0.5 : sample();
  } else if (anchor !== "center") {
    u = clamp01(anchor[0]);
    v = clamp01(anchor[1]);
  }
  const destX = usableMinX + width * u;
  const destZ = usableMinZ + depth * v;
  const destY = surface.max[1];
  const centerX = (target.min[0] + target.max[0]) / 2;
  const centerZ = (target.min[2] + target.max[2]) / 2;
  return [destX - centerX, destY - target.min[1], destZ - centerZ];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Move along Y so the AABB bottom meets `groundY`.
 *
 * @public
 */
export function snapToGroundDelta(target: Aabb, groundY: number): Vec3 {
  return [0, groundY - target.min[1], 0];
}

/**
 * Align `target` to `reference` on the given axes.
 *
 * @public
 */
export function alignToDelta(
  target: Aabb,
  reference: Aabb,
  axes: readonly ("x" | "y" | "z")[],
  mode: "min" | "center" | "max",
): Vec3 {
  const delta: [number, number, number] = [0, 0, 0];
  for (const axis of axes) {
    const index = axis === "x" ? 0 : axis === "y" ? 1 : 2;
    const tMin = target.min[index];
    const tMax = target.max[index];
    const rMin = reference.min[index];
    const rMax = reference.max[index];
    if (tMin === undefined || tMax === undefined || rMin === undefined || rMax === undefined) {
      continue;
    }
    const current = mode === "min" ? tMin : mode === "max" ? tMax : (tMin + tMax) / 2;
    const desired = mode === "min" ? rMin : mode === "max" ? rMax : (rMin + rMax) / 2;
    delta[index] = desired - current;
  }
  return delta;
}

/**
 * New world AABB-center positions for distribute (`04` §8.5).
 *
 * @public
 */
export function distributeCenters(
  centers: readonly Vec3[],
  axis: "x" | "y" | "z",
  spacing: number | "even" | undefined,
  from?: Vec3,
  to?: Vec3,
): readonly Vec3[] {
  if (centers.length === 0) {
    return [];
  }
  const index = axis === "x" ? 0 : axis === "y" ? 1 : 2;
  const start = from ?? centers[0];
  const end = to ?? centers[centers.length - 1];
  if (start === undefined || end === undefined) {
    return centers;
  }
  const axisStart = from === undefined ? minAxis(centers, index) : start[index];
  const axisEnd = to === undefined ? maxAxis(centers, index) : end[index];
  if (centers.length === 1) {
    const only = centers[0];
    if (only === undefined) {
      return centers;
    }
    return [setAxis(only, index, axisStart)];
  }
  const gap =
    spacing === undefined || spacing === "even"
      ? (axisEnd - axisStart) / (centers.length - 1)
      : spacing;
  return centers.map((center, order) => setAxis(center, index, axisStart + gap * order));
}

function minAxis(centers: readonly Vec3[], index: number): number {
  let min = Number.POSITIVE_INFINITY;
  for (const center of centers) {
    const value = center[index];
    if (value !== undefined) {
      min = Math.min(min, value);
    }
  }
  return min;
}

function maxAxis(centers: readonly Vec3[], index: number): number {
  let max = Number.NEGATIVE_INFINITY;
  for (const center of centers) {
    const value = center[index];
    if (value !== undefined) {
      max = Math.max(max, value);
    }
  }
  return max;
}

function setAxis(center: Vec3, index: number, value: number): Vec3 {
  return [
    index === 0 ? value : center[0],
    index === 1 ? value : center[1],
    index === 2 ? value : center[2],
  ];
}

/**
 * Grid world positions in input order (`04` §8.5).
 *
 * @public
 */
export function arrangeGridPositions(
  count: number,
  columns: number,
  spacing: Vec2,
  origin: Vec3 = [0, 0, 0],
  plane: "xz" | "xy" = "xz",
): readonly Vec3[] {
  const cols = Math.max(1, columns);
  const positions: Vec3[] = [];
  for (let order = 0; order < count; order += 1) {
    const col = order % cols;
    const row = Math.floor(order / cols);
    if (plane === "xy") {
      positions.push([origin[0] + col * spacing[0], origin[1] + row * spacing[1], origin[2]]);
    } else {
      positions.push([origin[0] + col * spacing[0], origin[1], origin[2] + row * spacing[1]]);
    }
  }
  return positions;
}

export function aabbCenter(box: Aabb): Vec3 {
  return [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2,
  ];
}
