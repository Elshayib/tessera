import { ColliderSchema, emptyDocument } from "@tessera/schema";
import { expect, test } from "vitest";
import { childrenOf, entityPath, eulerDegXyzToQuat, hexToRgb, resolveCollider } from "./math.js";

test("hexToRgb and eulerDegXyzToQuat are finite", () => {
  expect(hexToRgb("#ffffff")).toEqual([1, 1, 1]);
  expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
  const quat = eulerDegXyzToQuat([0, 0, 0]);
  expect(quat[3]).toBeCloseTo(1, 10);
});

test("resolveCollider auto uses primitive bounds", () => {
  const document = emptyDocument();
  const geometryId = "a_aaaaaaaaaa";
  const entityId = "e_aaaaaaaaaa";
  const collider = ColliderSchema.parse({ shape: "box", fit: "auto" });
  const documentWith = {
    ...document,
    assets: {
      [geometryId]: {
        id: geometryId,
        name: "box",
        license: "CC0-1.0",
        provenance: { source: "tessera", importedAt: document.meta.createdAt },
        createdAt: document.meta.createdAt,
        kind: "geometry" as const,
        source: {
          kind: "primitive" as const,
          primitive: { type: "box" as const, size: [2, 4, 6] as const },
        },
        bounds: { min: [-1, -2, -3] as const, max: [1, 2, 3] as const },
        stats: { triangles: 12, vertices: 8, primitiveGroups: 1 },
      },
    },
    entities: {
      [entityId]: {
        id: entityId,
        name: "Box",
        parent: null,
        order: "a0",
        enabled: true,
        components: {
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          meshRenderer: {
            geometry: geometryId,
            materials: [],
            castShadow: true,
            receiveShadow: true,
            visible: true,
          },
          collider,
        },
      },
    },
  };
  const entity = documentWith.entities[entityId];
  if (entity === undefined) {
    return;
  }
  const resolved = resolveCollider(collider, entity, documentWith);
  expect(resolved.shape).toBe("box");
  expect(resolved.size).toEqual([2, 4, 6]);
  const sphere = resolveCollider(
    ColliderSchema.parse({ shape: "sphere", fit: "auto" }),
    entity,
    documentWith,
  );
  expect(sphere.shape).toBe("sphere");
  const capsule = resolveCollider(
    ColliderSchema.parse({ shape: "capsule", fit: "auto" }),
    entity,
    documentWith,
  );
  expect(capsule.shape).toBe("capsule");
  const manual = resolveCollider(
    ColliderSchema.parse({ shape: "sphere", fit: "manual", radius: 0.4 }),
    entity,
    documentWith,
  );
  expect(manual.radius).toBe(0.4);
  const capsuleManual = resolveCollider(
    ColliderSchema.parse({ shape: "capsule", fit: "manual", radius: 0.2, height: 3 }),
    entity,
    documentWith,
  );
  expect(capsuleManual.height).toBe(3);
  const boxManual = resolveCollider(
    ColliderSchema.parse({ shape: "box", fit: "manual", size: [9, 8, 7] }),
    entity,
    documentWith,
  );
  expect(boxManual.size).toEqual([9, 8, 7]);
  expect(entityPath(documentWith, entityId)).toBe("/Box");
  expect(entityPath(documentWith, "e_missing000")).toBe("/");
  expect(childrenOf(documentWith, null)).toHaveLength(1);
  const blobGeo = {
    ...documentWith,
    assets: {
      ...documentWith.assets,
      [geometryId]: {
        ...documentWith.assets[geometryId],
        kind: "geometry" as const,
        source: {
          kind: "blob" as const,
          blob: {
            hash: "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            size: 4,
            mime: "model/gltf-binary",
          },
        },
        bounds: { min: [0, 0, 0] as const, max: [2, 2, 2] as const },
      },
    },
  };
  const blobEntity = blobGeo.entities[entityId];
  if (blobEntity !== undefined && blobGeo.assets[geometryId]?.kind === "geometry") {
    expect(resolveCollider(collider, blobEntity, blobGeo).size).toEqual([2, 2, 2]);
  }
});
