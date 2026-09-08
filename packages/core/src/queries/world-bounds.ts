import type { Aabb, Asset, Entity } from "@tessera/schema";
import { entityWorldMatrix } from "../commands/helpers.js";
import type { DocumentReader } from "../document-types.js";
import { transformPoint } from "../internal/math.js";

const CORNERS: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [0, 0, 1],
  [0, 1, 0],
  [0, 1, 1],
  [1, 0, 0],
  [1, 0, 1],
  [1, 1, 0],
  [1, 1, 1],
];

/**
 * World-space AABB for an entity using geometry bounds or a degenerate origin box (Q-0021).
 *
 * @internal
 */
export function entityWorldAabb(entity: Entity, reader: DocumentReader): Aabb {
  const world = entityWorldMatrix(entity, reader);
  const local = localAabb(entity, reader);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const corner of CORNERS) {
    const localPoint: [number, number, number] = [
      local.min[0] + (local.max[0] - local.min[0]) * corner[0],
      local.min[1] + (local.max[1] - local.min[1]) * corner[1],
      local.min[2] + (local.max[2] - local.min[2]) * corner[2],
    ];
    const worldPoint = transformPoint(world, localPoint);
    minX = Math.min(minX, worldPoint[0]);
    minY = Math.min(minY, worldPoint[1]);
    minZ = Math.min(minZ, worldPoint[2]);
    maxX = Math.max(maxX, worldPoint[0]);
    maxY = Math.max(maxY, worldPoint[1]);
    maxZ = Math.max(maxZ, worldPoint[2]);
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

/**
 * World-space origin of an entity.
 *
 * @internal
 */
export function entityWorldOrigin(
  entity: Entity,
  reader: DocumentReader,
): readonly [number, number, number] {
  return transformPoint(entityWorldMatrix(entity, reader), [0, 0, 0]);
}

/**
 * Euclidean gap between two AABBs (0 when they overlap).
 *
 * @internal
 */
export function aabbGap(a: Aabb, b: Aabb): number {
  const dx = Math.max(0, a.min[0] - b.max[0], b.min[0] - a.max[0]);
  const dy = Math.max(0, a.min[1] - b.max[1], b.min[1] - a.max[1]);
  const dz = Math.max(0, a.min[2] - b.max[2], b.min[2] - a.max[2]);
  return Math.hypot(dx, dy, dz);
}

/**
 * Space diagonal of an AABB.
 *
 * @internal
 */
export function aabbDiagonal(box: Aabb): number {
  return Math.hypot(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]);
}

/**
 * Union of two AABBs.
 *
 * @internal
 */
export function unionAabb(a: Aabb, b: Aabb): Aabb {
  return {
    min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
    max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
  };
}

function localAabb(entity: Entity, reader: DocumentReader): Aabb {
  const mesh = entity.components.meshRenderer;
  if (mesh === undefined) {
    return { min: [0, 0, 0], max: [0, 0, 0] };
  }
  const asset: Asset | undefined = reader.getAsset(mesh.geometry);
  if (asset === undefined || asset.kind !== "geometry") {
    return { min: [0, 0, 0], max: [0, 0, 0] };
  }
  return asset.bounds;
}
