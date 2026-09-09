import type { Document, Entity, Primitive } from "@tessera/schema";
import { primitiveBounds } from "@tessera/schema";
import { docBuilder } from "@tessera/testing";
import { expect, test } from "vitest";
import type { SpatialReader } from "./types.js";
import { localAabb, worldAabb } from "./world-aabb.js";

const PRIMITIVES: readonly Primitive[] = [
  { type: "box", size: [2, 4, 6] },
  { type: "sphere", radius: 2, segments: 8 },
  { type: "cylinder", radiusTop: 1, radiusBottom: 2, height: 4, segments: 8 },
  { type: "cone", radius: 3, height: 2, segments: 8 },
  { type: "plane", size: [4, 6] },
  { type: "torus", radius: 2, tube: 0.5, radialSegments: 8, tubularSegments: 8 },
  { type: "capsule", radius: 1, height: 4, segments: 8 },
];

function snapshotReader(snapshot: Document): SpatialReader {
  return {
    getEntity: (id) => snapshot.entities[id],
    getAsset: (id) => snapshot.assets[id],
    parentChain(id) {
      const chain: Entity[] = [];
      const visiting = new Set<string>();
      let current: string | null = id;
      while (current !== null) {
        if (visiting.has(current)) {
          break;
        }
        visiting.add(current);
        const entity = snapshot.entities[current];
        if (entity === undefined) {
          break;
        }
        chain.push(entity);
        current = entity.parent;
      }
      return chain;
    },
  };
}

function named(snapshot: Document, name: string): Entity | undefined {
  return Object.values(snapshot.entities).find((entity) => entity.name === name);
}

test("world AABB matches primitive bounds at identity", () => {
  for (const primitive of PRIMITIVES) {
    const snapshot = docBuilder()
      .geometry("mesh", primitive)
      .entity("body", { mesh: "mesh" })
      .build();
    const reader = snapshotReader(snapshot);
    const entity = named(snapshot, "body");
    expect(entity !== undefined).toBe(true);
    if (entity === undefined) {
      return;
    }
    const expected = primitiveBounds(primitive);
    const local = localAabb(entity, reader);
    const world = worldAabb(entity, reader);
    expect(maxDelta(local, expected)).toBeLessThan(1e-6);
    expect(maxDelta(world, expected)).toBeLessThan(1e-6);
  }
});

test("world AABB applies translation", () => {
  const snapshot = docBuilder()
    .geometry("mesh", { type: "box", size: [2, 2, 2] })
    .entity("body", { mesh: "mesh", transform: { position: [10, 0, 0] } })
    .build();
  const reader = snapshotReader(snapshot);
  const entity = named(snapshot, "body");
  expect(entity !== undefined).toBe(true);
  if (entity === undefined) {
    return;
  }
  const world = worldAabb(entity, reader);
  expect(maxDelta(world, { min: [9, -1, -1], max: [11, 1, 1] })).toBeLessThan(1e-6);
});

test("world AABB applies parent translation", () => {
  const snapshot = docBuilder()
    .geometry("mesh", { type: "box", size: [2, 2, 2] })
    .entity("root", { transform: { position: [5, 0, 0] } })
    .entity("body", { parent: "root", mesh: "mesh" })
    .build();
  const reader = snapshotReader(snapshot);
  const entity = named(snapshot, "body");
  expect(entity !== undefined).toBe(true);
  if (entity === undefined) {
    return;
  }
  const world = worldAabb(entity, reader);
  expect(maxDelta(world, { min: [4, -1, -1], max: [6, 1, 1] })).toBeLessThan(1e-6);
});

test("world AABB when parentChain omits entity", () => {
  const snapshot = docBuilder()
    .geometry("mesh", { type: "box", size: [2, 2, 2] })
    .entity("body", { mesh: "mesh", transform: { position: [3, 0, 0] } })
    .build();
  const reader = snapshotReader(snapshot);
  const entity = named(snapshot, "body");
  expect(entity !== undefined).toBe(true);
  if (entity === undefined) {
    return;
  }
  const world = worldAabb(entity, {
    getEntity: (id) => reader.getEntity(id),
    getAsset: (id) => reader.getAsset(id),
    parentChain: () => [],
  });
  expect(maxDelta(world, { min: [2, -1, -1], max: [4, 1, 1] })).toBeLessThan(1e-6);
});

test("missing mesh is a degenerate origin box", () => {
  const snapshot = docBuilder().entity("empty").build();
  const reader = snapshotReader(snapshot);
  const entity = named(snapshot, "empty");
  expect(entity !== undefined).toBe(true);
  if (entity === undefined) {
    return;
  }
  expect(localAabb(entity, reader)).toEqual({ min: [0, 0, 0], max: [0, 0, 0] });
});

test("missing geometry asset is a degenerate origin box", () => {
  const snapshot = docBuilder()
    .geometry("mesh", { type: "box", size: [2, 2, 2] })
    .entity("body", { mesh: "mesh" })
    .build();
  const reader = snapshotReader(snapshot);
  const entity = named(snapshot, "body");
  expect(entity !== undefined).toBe(true);
  if (entity === undefined) {
    return;
  }
  expect(
    localAabb(entity, {
      getEntity: (id) => reader.getEntity(id),
      getAsset: () => undefined,
      parentChain: (id) => reader.parentChain(id),
    }),
  ).toEqual({ min: [0, 0, 0], max: [0, 0, 0] });
});

function maxDelta(
  actual: { readonly min: readonly number[]; readonly max: readonly number[] },
  expected: { readonly min: readonly number[]; readonly max: readonly number[] },
): number {
  let delta = 0;
  for (let index = 0; index < 3; index += 1) {
    const aMin = actual.min[index];
    const eMin = expected.min[index];
    const aMax = actual.max[index];
    const eMax = expected.max[index];
    if (aMin === undefined || eMin === undefined || aMax === undefined || eMax === undefined) {
      return Number.POSITIVE_INFINITY;
    }
    delta = Math.max(delta, Math.abs(aMin - eMin), Math.abs(aMax - eMax));
  }
  return delta;
}
