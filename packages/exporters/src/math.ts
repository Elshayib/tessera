import type {
  Collider,
  Document,
  Entity,
  GeometryAsset,
  SidecarCollider,
  Vec3,
} from "@tessera/schema";
import { primitiveBounds } from "@tessera/schema";

/**
 * Converts document Euler XYZ degrees to a glTF quaternion `[x, y, z, w]`.
 *
 * @public
 */
export function eulerDegXyzToQuat(degrees: Vec3): readonly [number, number, number, number] {
  const x = (degrees[0] * Math.PI) / 180;
  const y = (degrees[1] * Math.PI) / 180;
  const z = (degrees[2] * Math.PI) / 180;
  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
}

/**
 * sRGB hex `#rrggbb` to 0–1 factors (matches import `toHex` inverse).
 *
 * @public
 */
export function hexToRgb(hex: string): readonly [number, number, number] {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return [r / 255, g / 255, b / 255];
}

function aabbSize(min: Vec3, max: Vec3): Vec3 {
  return [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
}

function aabbCenter(min: Vec3, max: Vec3): Vec3 {
  return [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
}

function geometryAabb(geometry: GeometryAsset): { min: Vec3; max: Vec3 } {
  if (geometry.source.kind === "primitive") {
    return primitiveBounds(geometry.source.primitive);
  }
  return geometry.bounds;
}

/**
 * Resolves collider extras for export (`09` §3.2). Auto-fit uses geometry bounds.
 *
 * @public
 */
export function resolveCollider(
  collider: Collider,
  entity: Entity,
  document: Document,
): SidecarCollider {
  const offset = collider.offset;
  if (collider.fit === "manual") {
    return manualCollider(collider, offset);
  }
  const geometryId = entity.components.meshRenderer?.geometry;
  const geometry = geometryId === undefined ? undefined : document.assets[geometryId];
  if (geometry === undefined || geometry.kind !== "geometry") {
    return manualCollider(collider, offset);
  }
  const bounds = geometryAabb(geometry);
  const size = aabbSize(bounds.min, bounds.max);
  const center = aabbCenter(bounds.min, bounds.max);
  if (collider.shape === "sphere") {
    const radius = Math.max(size[0], size[1], size[2]) / 2;
    return { shape: "sphere", radius, offset: center, isTrigger: collider.isTrigger };
  }
  if (collider.shape === "capsule") {
    const radius = Math.max(size[0], size[2]) / 2;
    return {
      shape: "capsule",
      radius,
      height: size[1],
      offset: center,
      isTrigger: collider.isTrigger,
    };
  }
  return { shape: collider.shape, size, offset: center, isTrigger: collider.isTrigger };
}

function manualCollider(collider: Collider, offset: Vec3): SidecarCollider {
  if (collider.shape === "sphere") {
    return { shape: "sphere", radius: collider.radius, offset, isTrigger: collider.isTrigger };
  }
  if (collider.shape === "capsule") {
    return {
      shape: "capsule",
      radius: collider.radius,
      height: collider.height,
      offset,
      isTrigger: collider.isTrigger,
    };
  }
  return { shape: collider.shape, size: collider.size, offset, isTrigger: collider.isTrigger };
}

/**
 * Entity path `/a/b` from parent names (`09` §3.3).
 *
 * @public
 */
export function entityPath(document: Document, id: string): string {
  const names: string[] = [];
  const visiting = new Set<string>();
  let current: string | null = id;
  while (current !== null) {
    if (visiting.has(current)) {
      break;
    }
    visiting.add(current);
    const entity: Entity | undefined = document.entities[current];
    if (entity === undefined) {
      break;
    }
    names.push(entity.name);
    current = entity.parent;
  }
  return `/${names.reverse().join("/")}`;
}

/**
 * Sibling-order children of `parent` (`09` §3.4).
 *
 * @public
 */
export function childrenOf(document: Document, parent: string | null): readonly Entity[] {
  const kids: Entity[] = [];
  for (const entity of Object.values(document.entities)) {
    if (entity.parent === parent) {
      kids.push(entity);
    }
  }
  kids.sort((left, right) => {
    if (left.order < right.order) {
      return -1;
    }
    if (left.order > right.order) {
      return 1;
    }
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
  return kids;
}
