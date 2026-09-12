import type {
  CommandSchema,
  Components,
  Document,
  Entity,
  EntityRef,
  Transform,
} from "@tessera/schema";
import { ComponentsSchema } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import { generateKeyBetween } from "fractional-indexing";
import type { CommandDefinition } from "../command-types.js";
import type { DocumentReader } from "../document-types.js";
import {
  composeTrs,
  identityMat4,
  keepWorldLocal,
  type Mat4,
  multiplyMat4,
} from "../internal/math.js";

/** Default name when `entity.create` omits `name` (Q-0011). */
export const DEFAULT_ENTITY_NAME = "Entity";

export function resolveEntityRef(
  reader: DocumentReader,
  ref: EntityRef,
): Result<Entity, TesseraError> {
  if (typeof ref === "string") {
    const entity = reader.getEntity(ref);
    if (entity === undefined) {
      return err(tesseraError("NOT_FOUND", "entity missing", { id: ref }));
    }
    return ok(entity);
  }
  const entity = reader.resolvePath(ref.path);
  if (entity === undefined) {
    return err(tesseraError("NOT_FOUND", "entity missing", { path: ref.path }));
  }
  return ok(entity);
}

export function resolveOptionalParent(
  reader: DocumentReader,
  parent: EntityRef | null | undefined,
): Result<string | null, TesseraError> {
  if (parent === undefined || parent === null) {
    return ok(null);
  }
  const resolved = resolveEntityRef(reader, parent);
  if (!resolved.ok) {
    return resolved;
  }
  return ok(resolved.value.id);
}

export function uniqueSiblingName(
  siblings: readonly Entity[],
  desired: string,
  strict: boolean,
  excludeId?: string,
): Result<string, TesseraError> {
  const taken = new Set(
    siblings
      .filter((sibling) => sibling.id !== excludeId)
      .map((sibling) => sibling.name.toLowerCase()),
  );
  if (!taken.has(desired.toLowerCase())) {
    return ok(desired);
  }
  if (strict) {
    return err(tesseraError("CONFLICT", "name already used by a sibling", { name: desired }));
  }
  for (let index = 1; index <= 99; index += 1) {
    const suffix = index < 10 ? `_0${String(index)}` : `_${String(index)}`;
    const candidate = `${desired}${suffix}`;
    if (candidate.length > 64) {
      return err(
        tesseraError("CONFLICT", "suffixed name exceeds 64 characters", { name: desired }),
      );
    }
    if (!taken.has(candidate.toLowerCase())) {
      return ok(candidate);
    }
  }
  return err(tesseraError("CONFLICT", "no unique sibling name available", { name: desired }));
}

export function uniqueAssetName(
  doc: Document,
  kind: string,
  desired: string,
  excludeId?: string,
): Result<string, TesseraError> {
  const taken = new Set<string>();
  for (const asset of Object.values(doc.assets)) {
    if (asset.kind === kind && asset.id !== excludeId) {
      taken.add(asset.name.toLowerCase());
    }
  }
  if (!taken.has(desired.toLowerCase())) {
    return ok(desired);
  }
  for (let index = 1; index <= 99; index += 1) {
    const suffix = index < 10 ? `_0${String(index)}` : `_${String(index)}`;
    const candidate = `${desired}${suffix}`;
    if (candidate.length > 64) {
      return err(
        tesseraError("CONFLICT", "suffixed name exceeds 64 characters", { name: desired }),
      );
    }
    if (!taken.has(candidate.toLowerCase())) {
      return ok(candidate);
    }
  }
  return err(tesseraError("CONFLICT", "no unique asset name available", { name: desired, kind }));
}

export function orderAfterSibling(
  siblings: readonly Entity[],
  afterId: string | null | undefined,
  excludeId?: string,
): Result<string, TesseraError> {
  const ordered = siblings
    .filter((sibling) => sibling.id !== excludeId)
    .slice()
    .sort((left, right) => (left.order < right.order ? -1 : left.order > right.order ? 1 : 0));
  if (afterId === null) {
    const first = ordered[0];
    return keyBetween(null, first === undefined ? null : first.order);
  }
  if (afterId === undefined) {
    const last = ordered[ordered.length - 1];
    return keyBetween(last === undefined ? null : last.order, null);
  }
  const afterIndex = ordered.findIndex((sibling) => sibling.id === afterId);
  if (afterIndex < 0) {
    return err(tesseraError("CONFLICT", "after is not a sibling", { after: afterId }));
  }
  const after = ordered[afterIndex];
  const next = ordered[afterIndex + 1];
  if (after === undefined) {
    return err(tesseraError("CONFLICT", "after is not a sibling", { after: afterId }));
  }
  return keyBetween(after.order, next === undefined ? null : next.order);
}

function keyBetween(lower: string | null, upper: string | null): Result<string, TesseraError> {
  try {
    return ok(generateKeyBetween(lower, upper));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "invalid order key";
    return err(tesseraError("INVARIANT_VIOLATION", message));
  }
}

export function subtreeIds(reader: DocumentReader, rootId: string): string[] {
  const ids: string[] = [];
  const walk = (id: string): void => {
    for (const child of reader.children(id)) {
      walk(child.id);
    }
    ids.push(id);
  };
  walk(rootId);
  return ids;
}

export function subtreeIdsRootFirst(reader: DocumentReader, rootId: string): string[] {
  const ids: string[] = [rootId];
  const walk = (id: string): void => {
    for (const child of reader.children(id)) {
      ids.push(child.id);
      walk(child.id);
    }
  };
  walk(rootId);
  return ids;
}

export function entityWorldMatrix(entity: Entity, reader: DocumentReader): Mat4 {
  const chain = [...reader.parentChain(entity.id)].reverse();
  if (chain.length === 0 || chain[chain.length - 1]?.id !== entity.id) {
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

export function parentWorldMatrix(entity: Entity, reader: DocumentReader): Mat4 {
  if (entity.parent === null) {
    return identityMat4();
  }
  const parent = reader.getEntity(entity.parent);
  if (parent === undefined) {
    return identityMat4();
  }
  return entityWorldMatrix(parent, reader);
}

export function recomputeLocalKeepWorld(
  entity: Entity,
  newParent: Entity | null,
  reader: DocumentReader,
): Result<Transform, TesseraError> {
  const world = entityWorldMatrix(entity, reader);
  const newParentWorld = newParent === null ? identityMat4() : entityWorldMatrix(newParent, reader);
  const local = keepWorldLocal(world, newParentWorld);
  if (local === undefined) {
    return err(tesseraError("CONFLICT", "cannot invert parent transform", { id: entity.id }));
  }
  return ok({
    position: [local.position[0], local.position[1], local.position[2]],
    rotation: [local.rotation[0], local.rotation[1], local.rotation[2]],
    scale: [local.scale[0], local.scale[1], local.scale[2]],
  });
}

export function cloneComponents(components: Components): Components {
  return ComponentsSchema.parse(JSON.parse(JSON.stringify(components)));
}

export function addVec3(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): [number, number, number] {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

export function scaleVec3(
  vector: readonly [number, number, number],
  factor: readonly [number, number, number],
): Result<[number, number, number], TesseraError> {
  const next: [number, number, number] = [
    vector[0] * factor[0],
    vector[1] * factor[1],
    vector[2] * factor[2],
  ];
  if (next[0] <= 0 || next[1] <= 0 || next[2] <= 0) {
    return err(tesseraError("INVALID_INPUT", "scale must stay positive"));
  }
  return ok(next);
}

export function normalizeEuler(
  rotation: readonly [number, number, number],
): [number, number, number] {
  return [normalizeDeg(rotation[0]), normalizeDeg(rotation[1]), normalizeDeg(rotation[2])];
}

function normalizeDeg(deg: number): number {
  let value = deg % 360;
  if (value > 180) {
    value -= 360;
  }
  if (value <= -180) {
    value += 360;
  }
  return value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mergeDeep(base: unknown, patch: unknown): unknown {
  if (isRecord(base) && isRecord(patch)) {
    const result: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) {
        continue;
      }
      result[key] = mergeDeep(result[key], value);
    }
    return result;
  }
  return patch;
}

export function collectBlobHashes(value: unknown, hashes: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectBlobHashes(item, hashes);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  const hash = value["hash"];
  const size = value["size"];
  const mime = value["mime"];
  if (typeof hash === "string" && typeof size === "number" && typeof mime === "string") {
    hashes.push(hash);
  }
  for (const nested of Object.values(value)) {
    collectBlobHashes(nested, hashes);
  }
}

export function defineCommand<I, O>(
  schema: CommandSchema<I, O>,
  impl: Pick<CommandDefinition<I, O>, "validate" | "handle">,
): CommandDefinition<I, O> {
  return { ...schema, ...impl };
}
