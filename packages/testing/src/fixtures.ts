import type { Document, Entity, GeometryAsset, Primitive } from "@tessera/schema";
import { emptyDocument, primitiveBounds } from "@tessera/schema";

const D1_SEED = 42;
const GROUP_COUNT = 100;
const CHILDREN_PER_GROUP = 99;
const ASSET_COUNT = 2_000;
const PRIMITIVE_TYPES = ["box", "sphere", "cylinder", "cone", "plane", "torus", "capsule"] as const;

/**
 * Deterministic reference-scene generators from `docs/01-engineering-standards.md` §8.
 *
 * @example
 * ```ts
 * const doc = fixtures.D1();
 * ```
 *
 * @public
 */
export const fixtures = {
  D1: buildD1,
};

function buildD1(): Document {
  const rand = mulberry32(D1_SEED);
  const base = emptyDocument("p_0000000000");
  const createdAt = base.meta.createdAt;
  const assets: Document["assets"] = {};

  for (let index = 0; index < ASSET_COUNT; index += 1) {
    const id = sequentialId("a", index);
    const type = primitiveTypeAt(index);
    const primitive = primitiveFor(type, 0.5 + rand() * 1.5);
    const asset: GeometryAsset = {
      id,
      name: `geom_${index.toString(10).padStart(4, "0")}`,
      license: "unknown",
      provenance: { source: "tessera", importedAt: createdAt },
      createdAt,
      kind: "geometry",
      source: { kind: "primitive", primitive },
      bounds: primitiveBounds(primitive),
      stats: { triangles: 12, vertices: 8, primitiveGroups: 1 },
    };
    assets[id] = asset;
  }

  const entities: Document["entities"] = {};
  let entityIndex = 0;
  for (let group = 0; group < GROUP_COUNT; group += 1) {
    const groupId = sequentialId("e", entityIndex);
    entityIndex += 1;
    const groupEntity: Entity = {
      id: groupId,
      name: `group_${group.toString(10).padStart(2, "0")}`,
      parent: null,
      order: groupId.slice(2),
      enabled: true,
      components: {
        transform: {
          position: [group, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
      },
    };
    entities[groupId] = groupEntity;
    for (let child = 0; child < CHILDREN_PER_GROUP; child += 1) {
      const childId = sequentialId("e", entityIndex);
      entityIndex += 1;
      const geometry = sequentialId("a", (group * CHILDREN_PER_GROUP + child) % ASSET_COUNT);
      const childEntity: Entity = {
        id: childId,
        name: `leaf_${child.toString(10).padStart(2, "0")}`,
        parent: groupId,
        order: childId.slice(2),
        enabled: true,
        components: {
          transform: {
            position: [child, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
          meshRenderer: {
            geometry,
            materials: [],
            castShadow: true,
            receiveShadow: true,
            visible: true,
          },
        },
      };
      entities[childId] = childEntity;
    }
  }

  return {
    ...base,
    meta: { ...base.meta, name: "D1" },
    entities,
    assets,
  };
}

function primitiveTypeAt(index: number): (typeof PRIMITIVE_TYPES)[number] {
  switch (index % 7) {
    case 0:
      return "box";
    case 1:
      return "sphere";
    case 2:
      return "cylinder";
    case 3:
      return "cone";
    case 4:
      return "plane";
    case 5:
      return "torus";
    default:
      return "capsule";
  }
}

function primitiveFor(type: (typeof PRIMITIVE_TYPES)[number], size: number): Primitive {
  switch (type) {
    case "box":
      return { type: "box", size: [size, size, size] };
    case "sphere":
      return { type: "sphere", radius: size / 2, segments: 16 };
    case "cylinder":
      return {
        type: "cylinder",
        radiusTop: size / 2,
        radiusBottom: size / 2,
        height: size,
        segments: 16,
      };
    case "cone":
      return { type: "cone", radius: size / 2, height: size, segments: 16 };
    case "plane":
      return { type: "plane", size: [size, size] };
    case "torus":
      return {
        type: "torus",
        radius: size / 2,
        tube: size / 8,
        radialSegments: 8,
        tubularSegments: 16,
      };
    case "capsule":
      return { type: "capsule", radius: size / 4, height: size, segments: 8 };
  }
}

function sequentialId(prefix: "e" | "a", index: number): string {
  return `${prefix}_${index.toString(36).padStart(10, "0")}`;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
