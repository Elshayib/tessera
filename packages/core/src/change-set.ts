import type { Asset, Document, Entity } from "@tessera/schema";

/**
 * One field-level change in a {@link ChangeSet}.
 *
 * @public
 */
export interface FieldChange {
  readonly path: string;
  readonly before: unknown;
  readonly after: unknown;
}

/**
 * Per-entity field updates.
 *
 * @public
 */
export interface EntityChange {
  readonly id: string;
  readonly fields: readonly FieldChange[];
}

/**
 * Per-asset field updates.
 *
 * @public
 */
export interface AssetChange {
  readonly id: string;
  readonly fields: readonly FieldChange[];
}

/**
 * Structured before/after description of a transaction (`docs/04-command-bus.md` §7).
 *
 * @public
 */
export interface ChangeSet {
  readonly entities: {
    readonly created: readonly string[];
    readonly deleted: readonly Entity[];
    readonly updated: readonly EntityChange[];
  };
  readonly assets: {
    readonly created: readonly string[];
    readonly deleted: readonly Asset[];
    readonly updated: readonly AssetChange[];
  };
  readonly environment?: readonly FieldChange[];
  readonly settings?: readonly FieldChange[];
  readonly behaviors: {
    readonly created: readonly string[];
    readonly deleted: readonly string[];
    readonly updated: readonly string[];
  };
  readonly summary: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function fieldChanges(before: unknown, after: unknown, path: string): FieldChange[] {
  if (jsonEqual(before, after)) {
    return [];
  }
  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const changes: FieldChange[] = [];
    for (const key of [...keys].sort()) {
      const child = path === "" ? key : `${path}.${key}`;
      changes.push(...fieldChanges(before[key], after[key], child));
    }
    return changes;
  }
  return [{ path, before, after }];
}

function sortedIds(record: object): string[] {
  return Object.keys(record).sort();
}

/**
 * Snapshot diff used as the conservative change-set derivation (Q-0013).
 *
 * @public
 */
export function deriveChangeSet(before: Document, after: Document, summary: string): ChangeSet {
  const entityCreated: string[] = [];
  const entityDeleted: Entity[] = [];
  const entityUpdated: EntityChange[] = [];
  for (const id of sortedIds(before.entities)) {
    const previous = before.entities[id];
    const next = after.entities[id];
    if (previous === undefined) {
      continue;
    }
    if (next === undefined) {
      entityDeleted.push(previous);
      continue;
    }
    const fields = fieldChanges(previous, next, "").filter((change) => change.path !== "id");
    if (fields.length > 0) {
      entityUpdated.push({ id, fields });
    }
  }
  for (const id of sortedIds(after.entities)) {
    if (before.entities[id] === undefined) {
      entityCreated.push(id);
    }
  }

  const assetCreated: string[] = [];
  const assetDeleted: Asset[] = [];
  const assetUpdated: AssetChange[] = [];
  for (const id of sortedIds(before.assets)) {
    const previous = before.assets[id];
    const next = after.assets[id];
    if (previous === undefined) {
      continue;
    }
    if (next === undefined) {
      assetDeleted.push(previous);
      continue;
    }
    const fields = fieldChanges(previous, next, "").filter((change) => change.path !== "id");
    if (fields.length > 0) {
      assetUpdated.push({ id, fields });
    }
  }
  for (const id of sortedIds(after.assets)) {
    if (before.assets[id] === undefined) {
      assetCreated.push(id);
    }
  }

  const behaviorCreated: string[] = [];
  const behaviorDeleted: string[] = [];
  const behaviorUpdated: string[] = [];
  for (const id of sortedIds(before.behaviors)) {
    const previous = before.behaviors[id];
    const next = after.behaviors[id];
    if (previous === undefined) {
      continue;
    }
    if (next === undefined) {
      behaviorDeleted.push(id);
      continue;
    }
    if (!jsonEqual(previous, next)) {
      behaviorUpdated.push(id);
    }
  }
  for (const id of sortedIds(after.behaviors)) {
    if (before.behaviors[id] === undefined) {
      behaviorCreated.push(id);
    }
  }

  const environment = fieldChanges(before.environment, after.environment, "");
  const settings = fieldChanges(before.settings, after.settings, "");
  const changeSet: ChangeSet = {
    entities: { created: entityCreated, deleted: entityDeleted, updated: entityUpdated },
    assets: { created: assetCreated, deleted: assetDeleted, updated: assetUpdated },
    behaviors: {
      created: behaviorCreated,
      deleted: behaviorDeleted,
      updated: behaviorUpdated,
    },
    summary,
  };
  if (environment.length > 0) {
    return settings.length > 0
      ? { ...changeSet, environment, settings }
      : { ...changeSet, environment };
  }
  if (settings.length > 0) {
    return { ...changeSet, settings };
  }
  return changeSet;
}

/**
 * True when a change set would be an empty history entry (`INV-CMD-03`).
 *
 * @public
 */
export function isChangeSetEmpty(changeSet: ChangeSet): boolean {
  return (
    changeSet.entities.created.length === 0 &&
    changeSet.entities.deleted.length === 0 &&
    changeSet.entities.updated.length === 0 &&
    changeSet.assets.created.length === 0 &&
    changeSet.assets.deleted.length === 0 &&
    changeSet.assets.updated.length === 0 &&
    changeSet.behaviors.created.length === 0 &&
    changeSet.behaviors.deleted.length === 0 &&
    changeSet.behaviors.updated.length === 0 &&
    (changeSet.environment === undefined || changeSet.environment.length === 0) &&
    (changeSet.settings === undefined || changeSet.settings.length === 0)
  );
}
