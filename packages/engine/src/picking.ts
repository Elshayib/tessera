import type { EntityId, Vec3 } from "@tessera/schema";
import type { Camera, Intersection, Object3D, Scene } from "three";
import { Mesh, Raycaster, Vector2 } from "three";
import { acceleratedRaycast, MeshBVH } from "three-mesh-bvh";
import type { PickResult, RaycastHit } from "./types.js";

const ENTITY_ID = /^e_[0-9a-z]{10}$/;

let raycastPatched = false;

/**
 * Screen-space pick options (`05` §6). `x`/`y` are CSS pixels from the canvas top-left.
 *
 * @public
 */
export interface PickQuery {
  readonly scene: Scene;
  readonly camera: Camera;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly includeHelperLayers?: boolean;
}

/**
 * World-space raycast options (`05` §12).
 *
 * @public
 */
export interface RaycastQuery {
  readonly scene: Scene;
  readonly origin: Vec3;
  readonly direction: Vec3;
  readonly maxDistance?: number;
  readonly includeHelperLayers?: boolean;
}

/**
 * Picks the nearest enabled mesh under a canvas point. Layers 1–2 are ignored unless requested.
 *
 * @example
 * ```ts
 * pick({ scene, camera, x: 10, y: 10, width: 800, height: 600 });
 * ```
 *
 * @public
 */
export function pick(query: PickQuery): PickResult | null {
  installRaycast();
  const raycaster = createRaycaster(query.includeHelperLayers === true);
  raycaster.firstHitOnly = true;
  const ndc = new Vector2((query.x / query.width) * 2 - 1, -(query.y / query.height) * 2 + 1);
  raycaster.setFromCamera(ndc, query.camera);
  const hit = firstHit(query.scene, raycaster);
  return hit;
}

/**
 * Raycasts enabled scene meshes. Layers 1–2 are ignored unless requested.
 *
 * @example
 * ```ts
 * raycast({ scene, origin: [0, 1, 5], direction: [0, 0, -1] });
 * ```
 *
 * @public
 */
export function raycast(query: RaycastQuery): readonly RaycastHit[] {
  installRaycast();
  const raycaster = createRaycaster(query.includeHelperLayers === true);
  raycaster.ray.origin.set(query.origin[0], query.origin[1], query.origin[2]);
  raycaster.ray.direction
    .set(query.direction[0], query.direction[1], query.direction[2])
    .normalize();
  raycaster.far = query.maxDistance ?? Number.POSITIVE_INFINITY;
  return allHits(query.scene, raycaster);
}

function installRaycast(): void {
  if (raycastPatched) {
    return;
  }
  Mesh.prototype.raycast = acceleratedRaycast;
  raycastPatched = true;
}

function createRaycaster(includeHelperLayers: boolean): Raycaster {
  const raycaster = new Raycaster();
  raycaster.layers.enable(0);
  if (includeHelperLayers) {
    raycaster.layers.enable(1);
    raycaster.layers.enable(2);
  }
  return raycaster;
}

function firstHit(scene: Scene, raycaster: Raycaster): PickResult | null {
  prepareMeshes(scene);
  const hits = raycaster.intersectObject(scene, true);
  for (const intersection of hits) {
    const mapped = mapHit(intersection);
    if (mapped !== undefined) {
      return mapped;
    }
  }
  return null;
}

function allHits(scene: Scene, raycaster: Raycaster): readonly RaycastHit[] {
  prepareMeshes(scene);
  const hits = raycaster.intersectObject(scene, true);
  const mapped: RaycastHit[] = [];
  const seen = new Set<string>();
  for (const intersection of hits) {
    const hit = mapHit(intersection);
    if (hit === undefined || seen.has(hit.entityId)) {
      continue;
    }
    seen.add(hit.entityId);
    mapped.push(hit);
  }
  return mapped;
}

function prepareMeshes(root: Object3D): void {
  root.traverse((object) => {
    if (object instanceof Mesh && object.geometry.boundsTree === undefined) {
      object.geometry.boundsTree = new MeshBVH(object.geometry);
    }
  });
  root.updateMatrixWorld(true);
}

function mapHit(intersection: Intersection): RaycastHit | undefined {
  if (!isVisibleChain(intersection.object)) {
    return undefined;
  }
  const entityId = findEntityId(intersection.object);
  if (entityId === undefined) {
    return undefined;
  }
  const normal = hitNormal(intersection);
  return {
    entityId,
    point: [intersection.point.x, intersection.point.y, intersection.point.z],
    normal,
    distance: intersection.distance,
  };
}

function findEntityId(object: Object3D): EntityId | undefined {
  let current: Object3D | null = object;
  while (current !== null) {
    const id = current.userData["entityId"];
    if (typeof id === "string" && ENTITY_ID.test(id)) {
      return id;
    }
    current = current.parent;
  }
  return undefined;
}

function isVisibleChain(object: Object3D): boolean {
  let current: Object3D | null = object;
  while (current !== null) {
    if (!current.visible) {
      return false;
    }
    current = current.parent;
  }
  return true;
}

function hitNormal(intersection: Intersection): Vec3 {
  const normal = intersection.normal;
  if (normal !== undefined) {
    return [normal.x, normal.y, normal.z];
  }
  const face = intersection.face;
  if (face !== undefined && face !== null) {
    const world = face.normal.clone().transformDirection(intersection.object.matrixWorld);
    return [world.x, world.y, world.z];
  }
  return [0, 1, 0];
}
