import type { Author, CommandBus, TransactionRecord } from "@tessera/core";
import type { AssetId, EntityId, Vec3 } from "@tessera/schema";
import { AssetIdSchema, EntityIdSchema } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import type {
  AssetInput,
  CommitPlanIds,
  CommitPlanOptions,
  EntityInput,
  ImportPlan,
} from "./import-plan.js";

/**
 * Result of {@link AssetService.commitPlan}.
 *
 * @public
 */
export interface CommitPlanResult extends CommitPlanIds {
  readonly transaction: TransactionRecord;
}

/**
 * Main-thread import façade (`08` §7.5). T-0109 implements `commitPlan` only (Q-0052).
 *
 * @public
 */
export interface AssetService {
  commitPlan(plan: ImportPlan, options: CommitPlanOptions): Result<CommitPlanResult, TesseraError>;
}

/**
 * Options for {@link createAssetService}.
 *
 * @public
 */
export interface CreateAssetServiceOptions {
  readonly bus: CommandBus;
}

/**
 * Creates an {@link AssetService} that commits import plans through the command bus.
 *
 * @example
 * ```ts
 * const service = createAssetService({ bus });
 * service.commitPlan(plan, { author: { kind: "user", id: "u1" } });
 * ```
 *
 * @public
 */
export function createAssetService(options: CreateAssetServiceOptions): AssetService {
  return {
    commitPlan(plan, commitOptions) {
      return commitPlan(options.bus, plan, commitOptions);
    },
  };
}

/**
 * Executes `asset.create` and `entity.create` in one transaction labeled `Import <fileName>`.
 *
 * @public
 */
export function commitPlan(
  bus: CommandBus,
  plan: ImportPlan,
  options: CommitPlanOptions,
): Result<CommitPlanResult, TesseraError> {
  const fileName =
    plan.blobs.find((blob) => blob.mime === "model/gltf-binary")?.fileName ??
    plan.blobs[0]?.fileName ??
    "untitled";
  const author: Author = options.author;
  const idMap = new Map<string, string>();
  const result = bus.transaction({ author, label: `Import ${fileName}` }, (tx) => {
    const assetIds: AssetId[] = [];
    for (const asset of sortForCommit(plan.assets)) {
      const created = tx.run("asset.create", { asset: remapUnknown(omitId(asset), idMap) });
      if (!created.ok) {
        return created;
      }
      const id = readAssetId(created.value);
      if (!id.ok) {
        return id;
      }
      idMap.set(asset.id, id.value);
      assetIds.push(id.value);
    }
    const entityIds: EntityId[] = [];
    for (const entity of plan.entities ?? []) {
      const created = tx.run("entity.create", entityCreateInput(entity, idMap, options));
      if (!created.ok) {
        return created;
      }
      const id = readEntityId(created.value);
      if (!id.ok) {
        return id;
      }
      idMap.set(entity.id, id.value);
      entityIds.push(id.value);
    }
    return ok({ assetIds, entityIds });
  });
  if (!result.ok) {
    return result;
  }
  return ok({
    assetIds: result.value.value.assetIds,
    entityIds: result.value.value.entityIds,
    transaction: result.value.transaction,
  });
}

function entityCreateInput(
  entity: EntityInput,
  idMap: Map<string, string>,
  options: CommitPlanOptions,
): {
  readonly name: string;
  readonly parent: CommitPlanOptions["parent"] | string | null;
  readonly components?: EntityInput["components"];
} {
  const parent =
    entity.parent === null ? (options.parent ?? null) : (idMap.get(entity.parent) ?? entity.parent);
  const remapped = remapUnknown(entity.components ?? {}, idMap);
  const components = isPartialComponents(remapped)
    ? offsetRoot(entity, remapped, options.position)
    : undefined;
  return {
    name: entity.name,
    parent,
    ...(components === undefined ? {} : { components }),
  };
}

function offsetRoot(
  entity: EntityInput,
  components: NonNullable<EntityInput["components"]>,
  position: Vec3 | undefined,
): NonNullable<EntityInput["components"]> {
  if (entity.parent !== null || position === undefined) {
    return components;
  }
  const transform = components.transform;
  if (transform === undefined) {
    return {
      ...components,
      transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] },
    };
  }
  return {
    ...components,
    transform: {
      ...transform,
      position: [
        transform.position[0] + position[0],
        transform.position[1] + position[1],
        transform.position[2] + position[2],
      ],
    },
  };
}

function isPartialComponents(value: unknown): value is NonNullable<EntityInput["components"]> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function omitId(asset: AssetInput): unknown {
  const { id: _id, ...rest } = asset;
  return rest;
}

function sortForCommit(assets: readonly AssetInput[]): AssetInput[] {
  const order = { texture: 0, material: 1, geometry: 2, environment: 3, script: 4 };
  return [...assets].sort((left, right) => order[left.kind] - order[right.kind]);
}

function remapUnknown(value: unknown, idMap: Map<string, string>): unknown {
  if (typeof value === "string") {
    return idMap.get(value) ?? value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => remapUnknown(entry, idMap));
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = remapUnknown(entry, idMap);
    }
    return out;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readAssetId(value: unknown): Result<AssetId, TesseraError> {
  const id = readId(value);
  if (!id.ok) {
    return id;
  }
  const parsed = AssetIdSchema.safeParse(id.value);
  if (!parsed.success) {
    return err(tesseraError("INVARIANT_VIOLATION", "create did not return an asset id"));
  }
  return ok(parsed.data);
}

function readEntityId(value: unknown): Result<EntityId, TesseraError> {
  const id = readId(value);
  if (!id.ok) {
    return id;
  }
  const parsed = EntityIdSchema.safeParse(id.value);
  if (!parsed.success) {
    return err(tesseraError("INVARIANT_VIOLATION", "create did not return an entity id"));
  }
  return ok(parsed.data);
}

function readId(value: unknown): Result<string, TesseraError> {
  if (!isRecord(value)) {
    return err(tesseraError("INVARIANT_VIOLATION", "create did not return an id"));
  }
  const id = value["id"];
  if (typeof id !== "string") {
    return err(tesseraError("INVARIANT_VIOLATION", "create did not return an id"));
  }
  return ok(id);
}
