import type {
  Document,
  Entity,
  GeometryAsset,
  MaterialAsset,
  Primitive,
  Transform,
  Vec3,
} from "@tessera/schema";
import { emptyDocument, primitiveBounds } from "@tessera/schema";
import { invariant } from "@tessera/std";

const DEFAULT_TRANSFORM: Transform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};

const DEFAULT_BOX: Primitive = { type: "box", size: [1, 1, 1] };

/**
 * Optional local transform overrides for {@link DocBuilder.entity}.
 *
 * @public
 */
export interface TransformBuild {
  readonly position?: Vec3;
  readonly rotation?: Vec3;
  readonly scale?: Vec3;
}

/**
 * Optional material fields for {@link DocBuilder.material}.
 *
 * @public
 */
export interface MaterialBuildFields {
  readonly model?: "pbr" | "unlit";
  readonly baseColor?: string;
  readonly metallic?: number;
  readonly roughness?: number;
}

/**
 * Options for {@link DocBuilder.entity}. `parent`, `mesh`, and `material` are names.
 *
 * @public
 */
export interface EntityBuildOptions {
  readonly parent?: string;
  readonly transform?: TransformBuild;
  readonly mesh?: string;
  readonly material?: string;
  readonly enabled?: boolean;
}

interface PendingEntity {
  readonly name: string;
  readonly parent: string | undefined;
  readonly transform: Transform;
  readonly mesh: string | undefined;
  readonly material: string | undefined;
  readonly enabled: boolean;
}

/**
 * Fluent builder that produces documents passing `validateDocument`.
 *
 * @example
 * ```ts
 * const doc = docBuilder()
 *   .entity("oak_01", { mesh: "oak" })
 *   .material("bark", { baseColor: "#8b5a2b" })
 *   .build();
 * ```
 *
 * @public
 */
export interface DocBuilder {
  entity(name: string, options?: EntityBuildOptions): DocBuilder;
  geometry(name: string, primitive?: Primitive): DocBuilder;
  material(name: string, fields?: MaterialBuildFields): DocBuilder;
  build(): Document;
}

/**
 * Starts a {@link DocBuilder}.
 *
 * @public
 */
export function docBuilder(): DocBuilder {
  return new DocBuilderImpl();
}

class DocBuilderImpl implements DocBuilder {
  readonly #entities: PendingEntity[] = [];
  readonly #entityNames = new Set<string>();
  readonly #geometries = new Map<string, Primitive>();
  readonly #materials = new Map<string, MaterialBuildFields | undefined>();

  entity(name: string, options: EntityBuildOptions = {}): DocBuilder {
    invariant(!this.#entityNames.has(name), `duplicate entity name '${name}'`);
    if (options.parent !== undefined) {
      invariant(
        this.#entityNames.has(options.parent),
        `parent entity '${options.parent}' must exist`,
      );
    }
    if (options.material !== undefined) {
      invariant(options.mesh !== undefined, "material requires mesh");
    }
    this.#entityNames.add(name);
    this.#entities.push({
      name,
      parent: options.parent,
      transform: mergeTransform(options.transform),
      mesh: options.mesh,
      material: options.material,
      enabled: options.enabled ?? true,
    });
    return this;
  }

  geometry(name: string, primitive: Primitive = DEFAULT_BOX): DocBuilder {
    invariant(!this.#geometries.has(name), `duplicate geometry name '${name}'`);
    this.#geometries.set(name, primitive);
    return this;
  }

  material(name: string, fields?: MaterialBuildFields): DocBuilder {
    invariant(!this.#materials.has(name), `duplicate material name '${name}'`);
    this.#materials.set(name, fields);
    return this;
  }

  build(): Document {
    const base = emptyDocument();
    const createdAt = base.meta.createdAt;
    const assets: Document["assets"] = {};
    const geometryIds = new Map<string, string>();
    const materialIds = new Map<string, string>();
    let assetIndex = 0;

    const ensureGeometry = (name: string): string => {
      const existing = geometryIds.get(name);
      if (existing !== undefined) {
        return existing;
      }
      const primitive = this.#geometries.get(name) ?? DEFAULT_BOX;
      const id = sequentialId("a", assetIndex);
      assetIndex += 1;
      const asset: GeometryAsset = geometryAsset(id, name, createdAt, primitive);
      assets[id] = asset;
      geometryIds.set(name, id);
      return id;
    };

    const ensureMaterial = (name: string): string => {
      const existing = materialIds.get(name);
      if (existing !== undefined) {
        return existing;
      }
      const id = sequentialId("a", assetIndex);
      assetIndex += 1;
      const asset: MaterialAsset = materialAsset(id, name, createdAt, this.#materials.get(name));
      assets[id] = asset;
      materialIds.set(name, id);
      return id;
    };

    for (const name of this.#geometries.keys()) {
      ensureGeometry(name);
    }
    for (const name of this.#materials.keys()) {
      ensureMaterial(name);
    }

    const entities: Document["entities"] = {};
    const entityIds = new Map<string, string>();
    const siblingIndex = new Map<string, number>();
    let entityIndex = 0;
    for (const pending of this.#entities) {
      const id = sequentialId("e", entityIndex);
      entityIndex += 1;
      entityIds.set(pending.name, id);
      const parent =
        pending.parent === undefined ? null : resolveParentId(entityIds, pending.parent);
      const components: Entity["components"] = {
        transform: pending.transform,
      };
      if (pending.mesh !== undefined) {
        components.meshRenderer = {
          geometry: ensureGeometry(pending.mesh),
          materials: pending.material === undefined ? [] : [ensureMaterial(pending.material)],
          castShadow: true,
          receiveShadow: true,
          visible: true,
        };
      }
      const parentKey = parent ?? "";
      const orderIndex = siblingIndex.get(parentKey) ?? 0;
      siblingIndex.set(parentKey, orderIndex + 1);
      const entity: Entity = {
        id,
        name: pending.name,
        parent,
        order: siblingOrderKey(orderIndex),
        enabled: pending.enabled,
        components,
      };
      entities[id] = entity;
    }

    return {
      ...base,
      entities,
      assets,
    };
  }
}

function resolveParentId(entityIds: Map<string, string>, parentName: string): string {
  const parentId = entityIds.get(parentName);
  invariant(parentId !== undefined, `parent entity '${parentName}' must exist`);
  return parentId;
}

function mergeTransform(input: TransformBuild | undefined): Transform {
  if (input === undefined) {
    return DEFAULT_TRANSFORM;
  }
  return {
    position: input.position ?? DEFAULT_TRANSFORM.position,
    rotation: input.rotation ?? DEFAULT_TRANSFORM.rotation,
    scale: input.scale ?? DEFAULT_TRANSFORM.scale,
  };
}

function sequentialId(prefix: "e" | "a", index: number): string {
  return `${prefix}_${index.toString(36).padStart(10, "0")}`;
}

/** Digit alphabet used by `fractional-indexing` 4.x (`generateKeyBetween`). */
const ORDER_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Sibling order keys the command bus can extend (`a0`, `a1`, …).
 * `id.slice(2)` is `0000000000`, which is not a valid fractional-index head.
 */
function siblingOrderKey(index: number): string {
  invariant(
    index >= 0 && index < ORDER_DIGITS.length,
    "docBuilder sibling count exceeds order alphabet",
  );
  const digit = ORDER_DIGITS[index];
  invariant(digit !== undefined, "order digit");
  return `a${digit}`;
}

function geometryAsset(
  id: string,
  name: string,
  createdAt: string,
  primitive: Primitive,
): GeometryAsset {
  return {
    id,
    name,
    license: "unknown",
    provenance: { source: "tessera", importedAt: createdAt },
    createdAt,
    kind: "geometry",
    source: { kind: "primitive", primitive },
    bounds: primitiveBounds(primitive),
    stats: { triangles: 12, vertices: 8, primitiveGroups: 1 },
  };
}

function materialAsset(
  id: string,
  name: string,
  createdAt: string,
  fields: MaterialBuildFields | undefined,
): MaterialAsset {
  return {
    id,
    name,
    license: "unknown",
    provenance: { source: "tessera", importedAt: createdAt },
    createdAt,
    kind: "material",
    model: fields?.model ?? "pbr",
    baseColor: fields?.baseColor ?? "#cccccc",
    metallic: fields?.metallic ?? 0,
    roughness: fields?.roughness ?? 0.6,
    normalScale: 1,
    occlusionStrength: 1,
    emissive: "#000000",
    emissiveStrength: 1,
    opacity: 1,
    alphaMode: "opaque",
    alphaCutoff: 0.5,
    doubleSided: false,
  };
}
