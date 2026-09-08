import { createDefaultMaterial, createPrimitiveMesh } from "@tessera/assets";
import type { Author, CommandBus, TransactionOutcome } from "@tessera/core";
import type { Primitive } from "@tessera/schema";
import { primitiveBounds } from "@tessera/schema";
import type { Clock, Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";

const DRAFT_MATERIAL_ID = "a_aaaaaaaaaa";

/**
 * Primitive kinds the create menu can add (`03` §6.2).
 *
 * @public
 */
export type CreatePrimitiveType = Primitive["type"];

/**
 * Punctual light kinds (`03` §5.3).
 *
 * @public
 */
export type CreateLightType = "directional" | "point" | "spot";

function outputId(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("id" in value)) {
    return undefined;
  }
  const id = value.id;
  return typeof id === "string" ? id : undefined;
}

function defaultPrimitive(type: CreatePrimitiveType): Primitive {
  if (type === "box") {
    return { type: "box", size: [1, 1, 1] };
  }
  if (type === "sphere") {
    return { type: "sphere", radius: 0.5, segments: 32 };
  }
  if (type === "cylinder") {
    return {
      type: "cylinder",
      radiusTop: 0.5,
      radiusBottom: 0.5,
      height: 1,
      segments: 32,
    };
  }
  if (type === "cone") {
    return { type: "cone", radius: 0.5, height: 1, segments: 32 };
  }
  if (type === "plane") {
    return { type: "plane", size: [1, 1] };
  }
  if (type === "torus") {
    return { type: "torus", radius: 0.5, tube: 0.2, radialSegments: 16, tubularSegments: 32 };
  }
  return { type: "capsule", radius: 0.5, height: 1, segments: 16 };
}

function unwrapCreate(
  result: Result<TransactionOutcome<{ readonly entityId: string }>, TesseraError>,
): Result<{ readonly entityId: string }, TesseraError> {
  if (!result.ok) {
    return result;
  }
  return ok(result.value.value);
}

function titleCase(type: string): string {
  if (type.length === 0) {
    return type;
  }
  const first = type.slice(0, 1);
  return `${first.toUpperCase()}${type.slice(1)}`;
}

/**
 * @example
 * ```ts
 * createPrimitiveEntity(bus, author, clock, "box");
 * ```
 *
 * @public
 */
export function createPrimitiveEntity(
  bus: CommandBus,
  author: Author,
  clock: Clock,
  type: CreatePrimitiveType,
): Result<{ readonly entityId: string }, TesseraError> {
  const primitive = defaultPrimitive(type);
  const mesh = createPrimitiveMesh(primitive);
  const now = clock.nowIso();
  const name = titleCase(type);
  const draft = createDefaultMaterial({ id: DRAFT_MATERIAL_ID, createdAt: now });
  const { id: _draftId, createdAt: _draftCreated, ...materialAsset } = draft;
  void _draftId;
  void _draftCreated;
  const result = bus.transaction({ author, label: `Create ${name}` }, (tx) => {
    const material = tx.run("asset.create", { asset: materialAsset });
    if (!material.ok) {
      return material;
    }
    const materialId = outputId(material.value);
    if (materialId === undefined) {
      return err(tesseraError("INVALID_INPUT", "material.create missing id"));
    }
    const geometry = tx.run("asset.create", {
      asset: {
        kind: "geometry",
        name,
        license: "unknown",
        provenance: { source: "primitive", importedAt: now },
        source: { kind: "primitive", primitive },
        bounds: primitiveBounds(primitive),
        stats: {
          triangles: mesh.indices.length / 3,
          vertices: mesh.positions.length / 3,
          primitiveGroups: 1,
        },
      },
    });
    if (!geometry.ok) {
      return geometry;
    }
    const geometryId = outputId(geometry.value);
    if (geometryId === undefined) {
      return err(tesseraError("INVALID_INPUT", "asset.create missing geometry id"));
    }
    const entity = tx.run("entity.create", {
      name,
      components: {
        meshRenderer: { geometry: geometryId, materials: [materialId] },
      },
    });
    if (!entity.ok) {
      return entity;
    }
    const entityId = outputId(entity.value);
    if (entityId === undefined) {
      return err(tesseraError("INVALID_INPUT", "entity.create missing id"));
    }
    return ok({ entityId });
  });
  return unwrapCreate(result);
}

/**
 * Creates an entity with a punctual light component.
 *
 * @example
 * ```ts
 * createLightEntity(bus, author, "point");
 * ```
 *
 * @public
 */
export function createLightEntity(
  bus: CommandBus,
  author: Author,
  type: CreateLightType,
): Result<{ readonly entityId: string }, TesseraError> {
  const name = `${titleCase(type)} Light`;
  const result = bus.transaction({ author, label: `Create ${name}` }, (tx) => {
    const entity = tx.run("entity.create", {
      name,
      components: { light: { type } },
    });
    if (!entity.ok) {
      return entity;
    }
    const entityId = outputId(entity.value);
    if (entityId === undefined) {
      return err(tesseraError("INVALID_INPUT", "entity.create missing id"));
    }
    return ok({ entityId });
  });
  return unwrapCreate(result);
}

/**
 * Creates a camera entity and sets it as the main camera.
 *
 * @example
 * ```ts
 * createCameraEntity(bus, author);
 * ```
 *
 * @public
 */
export function createCameraEntity(
  bus: CommandBus,
  author: Author,
): Result<{ readonly entityId: string }, TesseraError> {
  const result = bus.transaction({ author, label: "Create Camera" }, (tx) => {
    const entity = tx.run("entity.create", {
      name: "Camera",
      components: { camera: {} },
    });
    if (!entity.ok) {
      return entity;
    }
    const entityId = outputId(entity.value);
    if (entityId === undefined) {
      return err(tesseraError("INVALID_INPUT", "entity.create missing id"));
    }
    const main = tx.run("camera.setMain", { target: entityId });
    if (!main.ok) {
      return main;
    }
    return ok({ entityId });
  });
  return unwrapCreate(result);
}
