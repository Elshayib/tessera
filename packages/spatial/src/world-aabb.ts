import type { Aabb, Asset, Entity } from "@tessera/schema";
import { composeTrs, identityMat4, multiplyMat4, transformPoint } from "./math.js";
import type { SpatialReader } from "./types.js";

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

const ORIGIN_BOX: Aabb = { min: [0, 0, 0], max: [0, 0, 0] };

/**
 * Local-space AABB from geometry bounds, or a degenerate origin box.
 *
 * @public
 */
export function localAabb(entity: Entity, reader: SpatialReader): Aabb {
  const mesh = entity.components.meshRenderer;
  if (mesh === undefined) {
    return ORIGIN_BOX;
  }
  const asset: Asset | undefined = reader.getAsset(mesh.geometry);
  if (asset === undefined || asset.kind !== "geometry") {
    return ORIGIN_BOX;
  }
  return asset.bounds;
}

/**
 * World-space AABB for an entity. No `three` Object3D (`05` §5, T-0103).
 *
 * @example
 * ```ts
 * const box = worldAabb(entity, reader);
 * ```
 *
 * @public
 */
export function worldAabb(entity: Entity, reader: SpatialReader): Aabb {
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

function entityWorldMatrix(entity: Entity, reader: SpatialReader) {
  const chain = [...reader.parentChain(entity.id)].reverse();
  const last = chain[chain.length - 1];
  if (chain.length === 0 || last?.id !== entity.id) {
    chain.push(entity);
  }
  let world = identityMat4();
  for (const node of chain) {
    const transform = node.components.transform;
    world = multiplyMat4(
      world,
      composeTrs(transform.position, transform.rotation, transform.scale),
    );
  }
  return world;
}
