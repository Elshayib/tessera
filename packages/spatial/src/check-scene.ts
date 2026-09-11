import type { Aabb, Entity } from "@tessera/schema";
import { aabbOverlaps } from "./aabb.js";
import { localNegZ } from "./look-at.js";
import priorsJson from "./size-priors.json" with { type: "json" };
import type { CheckSceneReader } from "./types.js";
import { localAabb, worldAabb } from "./world-aabb.js";

const OVERLAP_FRACTION = 0.05;
const VERTICAL_EPS = 0.05;
const POSITION_LIMIT = 10_000;
const SCALE_MAX = 1000;
const SCALE_MIN = 0.001;
const FLOAT_TAGS = new Set(["prop", "furniture", "vehicle"]);

const SIZE_PRIORS: Readonly<Record<string, number>> = priorsJson;

/**
 * One spatial issue (`06` §8.1).
 *
 * @public
 */
export interface SpatialIssue {
  readonly entity: string;
  readonly path: string;
  readonly check: string;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly suggestedTool?: { readonly name: string; readonly input: unknown };
}

/**
 * Result of {@link checkScene}.
 *
 * @public
 */
export interface SpatialCheckResult {
  readonly issues: readonly SpatialIssue[];
}

/**
 * Seven headless spatial checks on changed entities (`06` §8.1).
 *
 * @example
 * ```ts
 * checkScene(reader, ["e_0000000000"]);
 * ```
 *
 * @public
 */
export function checkScene(
  reader: CheckSceneReader,
  changedEntities: readonly string[],
): SpatialCheckResult {
  const all = [...reader.entities()];
  const meshes = all.filter((entity) => entity.components.meshRenderer !== undefined);
  const boxes = new Map<string, Aabb>();
  for (const entity of meshes) {
    boxes.set(entity.id, worldAabbFast(entity, reader));
  }
  const issues: SpatialIssue[] = [];
  const seen = new Set<string>();
  for (const id of changedEntities) {
    const entity = reader.getEntity(id);
    if (entity === undefined) {
      continue;
    }
    overlapIssues(entity, meshes, boxes, reader, issues, seen);
    verticalIssues(entity, meshes, boxes, reader, issues);
    boundsIssues(entity, reader, issues);
    sizeIssues(entity, boxes.get(id), reader, issues);
    const geometry = entity.components.meshRenderer?.geometry;
    if (geometry !== undefined) {
      duplicateIssues(entity, all, reader, issues);
    }
    if (entity.components.light !== undefined || entity.components.camera !== undefined) {
      orphanIssues(entity, meshes, boxes, reader, issues);
    }
  }
  return { issues };
}

function overlapIssues(
  entity: Entity,
  meshes: readonly Entity[],
  boxes: ReadonlyMap<string, Aabb>,
  reader: CheckSceneReader,
  issues: SpatialIssue[],
  seen: Set<string>,
): void {
  const self = boxes.get(entity.id);
  if (self === undefined || aabbVolume(self) <= 0) {
    return;
  }
  for (const other of meshes) {
    if (other.id === entity.id) {
      continue;
    }
    const otherBox = boxes.get(other.id);
    if (otherBox === undefined || !aabbOverlaps(self, otherBox)) {
      continue;
    }
    const pair = entity.id < other.id ? `${entity.id}:${other.id}` : `${other.id}:${entity.id}`;
    if (seen.has(pair)) {
      continue;
    }
    if (related(entity.id, other.id, reader)) {
      continue;
    }
    if (hasTag(entity, "overlap-ok") || hasTag(other, "overlap-ok")) {
      continue;
    }
    const smaller = Math.min(aabbVolume(self), aabbVolume(otherBox));
    if (smaller <= 0) {
      continue;
    }
    const overlap = intersectionVolume(self, otherBox);
    if (overlap / smaller <= OVERLAP_FRACTION) {
      continue;
    }
    seen.add(pair);
    issues.push(
      issue(entity, reader, "overlap", "error", "oriented bounds overlap another mesh", {
        name: "layout.resolveOverlaps",
        input: { targets: [entity.id, other.id] },
      }),
    );
  }
}

function verticalIssues(
  entity: Entity,
  meshes: readonly Entity[],
  boxes: ReadonlyMap<string, Aabb>,
  reader: CheckSceneReader,
  issues: SpatialIssue[],
): void {
  if (!needsGround(entity)) {
    return;
  }
  const box = boxes.get(entity.id);
  if (box === undefined) {
    return;
  }
  const support = supportingY(entity.id, box, meshes, boxes);
  const bottom = box.min[1];
  const snap = {
    name: "layout.snapToGround",
    input: { targets: [entity.id] },
  };
  if (bottom > support + VERTICAL_EPS) {
    issues.push(
      issue(entity, reader, "floating", "warning", "bottom is above the supporting surface", snap),
    );
  }
  if (bottom < support - VERTICAL_EPS) {
    issues.push(
      issue(entity, reader, "buried", "error", "bottom is below the supporting surface", snap),
    );
  }
}

function boundsIssues(entity: Entity, reader: CheckSceneReader, issues: SpatialIssue[]): void {
  const position = entity.components.transform.position;
  const scale = entity.components.transform.scale;
  const magnitude = Math.hypot(position[0], position[1], position[2]);
  const scaleBad = scale.some((value) => value > SCALE_MAX || value < SCALE_MIN);
  if (magnitude <= POSITION_LIMIT && !scaleBad) {
    return;
  }
  issues.push(
    issue(entity, reader, "out-of-bounds", "error", "position magnitude or scale is out of range"),
  );
}

function sizeIssues(
  entity: Entity,
  box: Aabb | undefined,
  reader: CheckSceneReader,
  issues: SpatialIssue[],
): void {
  if (box === undefined) {
    return;
  }
  const height = box.max[1] - box.min[1];
  const haystack = `${entity.name} ${(entity.components.tags ?? []).join(" ")}`.toLowerCase();
  for (const [keyword, prior] of Object.entries(SIZE_PRIORS)) {
    if (prior === undefined || prior <= 0 || !haystack.includes(keyword)) {
      continue;
    }
    const ratio = Math.max(height / prior, prior / Math.max(height, 1e-9));
    if (ratio <= 3) {
      continue;
    }
    issues.push(
      issue(
        entity,
        reader,
        "size-sanity",
        "warning",
        `bounds deviate from size prior '${keyword}'`,
      ),
    );
  }
}

function duplicateIssues(
  entity: Entity,
  all: readonly Entity[],
  reader: CheckSceneReader,
  issues: SpatialIssue[],
): void {
  const geometry = entity.components.meshRenderer?.geometry;
  if (geometry === undefined) {
    return;
  }
  const transform = JSON.stringify(entity.components.transform);
  for (const other of all) {
    if (other.id <= entity.id || other.parent !== entity.parent) {
      continue;
    }
    if (other.components.meshRenderer?.geometry !== geometry) {
      continue;
    }
    if (JSON.stringify(other.components.transform) !== transform) {
      continue;
    }
    issues.push(
      issue(
        entity,
        reader,
        "duplicates",
        "warning",
        "identical transform and geometry among siblings",
      ),
    );
    return;
  }
}

function orphanIssues(
  entity: Entity,
  meshes: readonly Entity[],
  boxes: ReadonlyMap<string, Aabb>,
  reader: CheckSceneReader,
  issues: SpatialIssue[],
): void {
  const light = entity.components.light;
  if (light !== undefined && (light.type === "point" || light.type === "spot") && light.range > 0) {
    const origin = worldAabbFast(entity, reader);
    const center: [number, number, number] = [
      (origin.min[0] + origin.max[0]) / 2,
      (origin.min[1] + origin.max[1]) / 2,
      (origin.min[2] + origin.max[2]) / 2,
    ];
    const lit = meshes.some((mesh) => {
      const box = boxes.get(mesh.id);
      if (box === undefined) {
        return false;
      }
      return pointAabbDistance(center, box) <= light.range;
    });
    if (!lit) {
      issues.push(issue(entity, reader, "orphans", "info", "light has no entities within range"));
    }
  }
  if (entity.components.camera === undefined) {
    return;
  }
  const origin = worldAabbFast(entity, reader);
  const from: [number, number, number] = [
    (origin.min[0] + origin.max[0]) / 2,
    (origin.min[1] + origin.max[1]) / 2,
    (origin.min[2] + origin.max[2]) / 2,
  ];
  const dir = localNegZ(entity.components.transform.rotation);
  const far = entity.components.camera.far;
  const sees = meshes.some((mesh) => {
    const box = boxes.get(mesh.id);
    if (box === undefined) {
      return false;
    }
    const cx = (box.min[0] + box.max[0]) / 2 - from[0];
    const cy = (box.min[1] + box.max[1]) / 2 - from[1];
    const cz = (box.min[2] + box.max[2]) / 2 - from[2];
    const dist = Math.hypot(cx, cy, cz);
    return dist <= far && cx * dir[0] + cy * dir[1] + cz * dir[2] > 0;
  });
  if (sees) {
    return;
  }
  issues.push(
    issue(entity, reader, "orphans", "info", "camera is pointing at nothing", {
      name: "camera.fit",
      input: { camera: entity.id, targets: "all" },
    }),
  );
}

function supportingY(
  id: string,
  box: Aabb,
  meshes: readonly Entity[],
  boxes: ReadonlyMap<string, Aabb>,
): number {
  let support = 0;
  for (const other of meshes) {
    if (other.id === id) {
      continue;
    }
    const otherBox = boxes.get(other.id);
    if (otherBox === undefined) {
      continue;
    }
    if (!xzOverlap(box, otherBox)) {
      continue;
    }
    if (otherBox.max[1] > box.min[1] + VERTICAL_EPS) {
      continue;
    }
    support = Math.max(support, otherBox.max[1]);
  }
  return support;
}

function xzOverlap(a: Aabb, b: Aabb): boolean {
  return (
    a.min[0] <= b.max[0] && a.max[0] >= b.min[0] && a.min[2] <= b.max[2] && a.max[2] >= b.min[2]
  );
}

function needsGround(entity: Entity): boolean {
  if (entity.components.rigidBody !== undefined) {
    return true;
  }
  return (entity.components.tags ?? []).some((tag) => FLOAT_TAGS.has(tag));
}

function related(a: string, b: string, reader: CheckSceneReader): boolean {
  return inChain(a, b, reader) || inChain(b, a, reader);
}

function inChain(id: string, ancestor: string, reader: CheckSceneReader): boolean {
  for (const node of reader.parentChain(id)) {
    if (node.id === ancestor && id !== ancestor) {
      return true;
    }
  }
  return false;
}

function hasTag(entity: Entity, tag: string): boolean {
  return (entity.components.tags ?? []).includes(tag);
}

function issue(
  entity: Entity,
  reader: CheckSceneReader,
  check: string,
  severity: SpatialIssue["severity"],
  message: string,
  suggestedTool?: SpatialIssue["suggestedTool"],
): SpatialIssue {
  const path = reader.pathOf(entity.id) ?? `/${entity.name}`;
  if (suggestedTool === undefined) {
    return { entity: entity.id, path, check, severity, message };
  }
  return { entity: entity.id, path, check, severity, message, suggestedTool };
}

function aabbVolume(box: Aabb): number {
  return (
    Math.max(0, box.max[0] - box.min[0]) *
    Math.max(0, box.max[1] - box.min[1]) *
    Math.max(0, box.max[2] - box.min[2])
  );
}

function intersectionVolume(a: Aabb, b: Aabb): number {
  if (!aabbOverlaps(a, b)) {
    return 0;
  }
  const minX = Math.max(a.min[0], b.min[0]);
  const minY = Math.max(a.min[1], b.min[1]);
  const minZ = Math.max(a.min[2], b.min[2]);
  const maxX = Math.min(a.max[0], b.max[0]);
  const maxY = Math.min(a.max[1], b.max[1]);
  const maxZ = Math.min(a.max[2], b.max[2]);
  return Math.max(0, maxX - minX) * Math.max(0, maxY - minY) * Math.max(0, maxZ - minZ);
}

function pointAabbDistance(point: readonly [number, number, number], box: Aabb): number {
  const dx = Math.max(box.min[0] - point[0], 0, point[0] - box.max[0]);
  const dy = Math.max(box.min[1] - point[1], 0, point[1] - box.max[1]);
  const dz = Math.max(box.min[2] - point[2], 0, point[2] - box.max[2]);
  return Math.hypot(dx, dy, dz);
}

function worldAabbFast(entity: Entity, reader: CheckSceneReader): Aabb {
  const chain = [...reader.parentChain(entity.id)];
  if (chain[0]?.id !== entity.id) {
    chain.unshift(entity);
  }
  let x = 0;
  let y = 0;
  let z = 0;
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const node = chain[index];
    if (node === undefined) {
      continue;
    }
    const transform = node.components.transform;
    if (
      transform.rotation[0] !== 0 ||
      transform.rotation[1] !== 0 ||
      transform.rotation[2] !== 0 ||
      transform.scale[0] !== 1 ||
      transform.scale[1] !== 1 ||
      transform.scale[2] !== 1
    ) {
      return worldAabb(entity, reader);
    }
    x += transform.position[0];
    y += transform.position[1];
    z += transform.position[2];
  }
  const local = localAabb(entity, reader);
  return {
    min: [local.min[0] + x, local.min[1] + y, local.min[2] + z],
    max: [local.max[0] + x, local.max[1] + y, local.max[2] + z],
  };
}
