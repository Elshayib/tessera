import type { Asset, Behavior, DocumentMeta, Entity, Environment, Settings } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { err, invariant, ok, tesseraError } from "@tessera/std";
import * as Y from "yjs";
import type { DocumentHandle } from "../document-types.js";
import {
  assetsMap,
  behaviorsMap,
  entitiesMap,
  fromYDoc,
  rootMap,
  writeAssetMap,
  writeBehaviorMap,
  writeEntityMap,
  writeNamedMap,
} from "../yjs-mapping.js";

/**
 * The only object that mutates Yjs maps (`docs/04-command-bus.md` §3).
 *
 * @internal
 */
export interface DocumentWriter {
  createEntity(entity: Entity): Result<void, TesseraError>;
  updateEntity(entity: Entity): Result<void, TesseraError>;
  deleteEntity(id: string): Result<void, TesseraError>;
  removeEntityUnchecked(id: string): Result<void, TesseraError>;
  createAsset(asset: Asset): Result<void, TesseraError>;
  updateAsset(asset: Asset): Result<void, TesseraError>;
  deleteAsset(id: string): Result<void, TesseraError>;
  upsertBehavior(behavior: Behavior): Result<void, TesseraError>;
  deleteBehavior(id: string): Result<void, TesseraError>;
  setEnvironment(environment: Environment): Result<void, TesseraError>;
  setSettings(settings: Settings): Result<void, TesseraError>;
  setMeta(meta: DocumentMeta): Result<void, TesseraError>;
}

/**
 * Writer that does not open Yjs transactions. The command bus wraps mutations.
 *
 * @internal
 */
export function createDocumentWriter(ydoc: Y.Doc): DocumentWriter {
  const createEntity = (entity: Entity): Result<void, TesseraError> => {
    const entities = entitiesMap(ydoc);
    if (entities.has(entity.id)) {
      return err(tesseraError("CONFLICT", "entity already exists", { id: entity.id }));
    }
    const parentError = checkParent(ydoc, entity.id, entity.parent);
    if (parentError !== undefined) {
      return err(parentError);
    }
    const entry = new Y.Map<unknown>();
    entities.set(entity.id, entry);
    writeEntityMap(entry, entity);
    return ok(undefined);
  };

  return {
    createEntity,
    updateEntity(entity) {
      const entities = entitiesMap(ydoc);
      if (!entities.has(entity.id)) {
        return err(tesseraError("NOT_FOUND", "entity missing", { id: entity.id }));
      }
      const parentError = checkParent(ydoc, entity.id, entity.parent);
      if (parentError !== undefined) {
        return err(parentError);
      }
      const existing = entities.get(entity.id);
      const entry = existing instanceof Y.Map ? existing : new Y.Map<unknown>();
      if (!(existing instanceof Y.Map)) {
        entities.set(entity.id, entry);
      }
      writeEntityMap(entry, entity);
      return ok(undefined);
    },
    deleteEntity(id) {
      const entities = entitiesMap(ydoc);
      if (!entities.has(id)) {
        return err(tesseraError("NOT_FOUND", "entity missing", { id }));
      }
      const snapshot = fromYDoc(ydoc);
      for (const entity of Object.values(snapshot.entities)) {
        if (entity.parent === id) {
          return err(tesseraError("CONFLICT", "entity has children", { id }));
        }
      }
      entities.delete(id);
      return ok(undefined);
    },
    removeEntityUnchecked(id) {
      const entities = entitiesMap(ydoc);
      if (!entities.has(id)) {
        return err(tesseraError("NOT_FOUND", "entity missing", { id }));
      }
      entities.delete(id);
      return ok(undefined);
    },
    createAsset(asset) {
      const assets = assetsMap(ydoc);
      if (assets.has(asset.id)) {
        return err(tesseraError("CONFLICT", "asset already exists", { id: asset.id }));
      }
      const entry = new Y.Map<unknown>();
      assets.set(asset.id, entry);
      writeAssetMap(entry, asset);
      return ok(undefined);
    },
    updateAsset(asset) {
      const assets = assetsMap(ydoc);
      if (!assets.has(asset.id)) {
        return err(tesseraError("NOT_FOUND", "asset missing", { id: asset.id }));
      }
      const existing = assets.get(asset.id);
      const entry = existing instanceof Y.Map ? existing : new Y.Map<unknown>();
      if (!(existing instanceof Y.Map)) {
        assets.set(asset.id, entry);
      }
      writeAssetMap(entry, asset);
      return ok(undefined);
    },
    deleteAsset(id) {
      const assets = assetsMap(ydoc);
      if (!assets.has(id)) {
        return err(tesseraError("NOT_FOUND", "asset missing", { id }));
      }
      assets.delete(id);
      return ok(undefined);
    },
    upsertBehavior(behavior) {
      const behaviors = behaviorsMap(ydoc);
      const existing = behaviors.get(behavior.id);
      const entry = existing instanceof Y.Map ? existing : new Y.Map<unknown>();
      if (!(existing instanceof Y.Map)) {
        behaviors.set(behavior.id, entry);
      }
      writeBehaviorMap(entry, behavior);
      return ok(undefined);
    },
    deleteBehavior(id) {
      const behaviors = behaviorsMap(ydoc);
      if (!behaviors.has(id)) {
        return err(tesseraError("NOT_FOUND", "behavior missing", { id }));
      }
      behaviors.delete(id);
      return ok(undefined);
    },
    setEnvironment(environment) {
      writeNamedMap(rootMap(ydoc), "environment", environment);
      return ok(undefined);
    },
    setSettings(settings) {
      writeNamedMap(rootMap(ydoc), "settings", settings);
      return ok(undefined);
    },
    setMeta(meta) {
      writeNamedMap(rootMap(ydoc), "meta", meta);
      return ok(undefined);
    },
  };
}

/**
 * Test-only writer that opens a transaction per call.
 *
 * @internal
 */
export function createTestWriter(doc: DocumentHandle): DocumentWriter {
  const inner = createDocumentWriter(doc.ydoc);
  const wrap = <A extends readonly unknown[]>(
    fn: (...args: A) => Result<void, TesseraError>,
  ): ((...args: A) => Result<void, TesseraError>) => {
    return (...args: A): Result<void, TesseraError> => {
      let result: Result<void, TesseraError> | undefined;
      doc.ydoc.transact(() => {
        result = fn(...args);
      });
      invariant(result !== undefined, "writer transact ran");
      return result;
    };
  };
  return {
    createEntity: wrap(inner.createEntity.bind(inner)),
    updateEntity: wrap(inner.updateEntity.bind(inner)),
    deleteEntity: wrap(inner.deleteEntity.bind(inner)),
    removeEntityUnchecked: wrap(inner.removeEntityUnchecked.bind(inner)),
    createAsset: wrap(inner.createAsset.bind(inner)),
    updateAsset: wrap(inner.updateAsset.bind(inner)),
    deleteAsset: wrap(inner.deleteAsset.bind(inner)),
    upsertBehavior: wrap(inner.upsertBehavior.bind(inner)),
    deleteBehavior: wrap(inner.deleteBehavior.bind(inner)),
    setEnvironment: wrap(inner.setEnvironment.bind(inner)),
    setSettings: wrap(inner.setSettings.bind(inner)),
    setMeta: wrap(inner.setMeta.bind(inner)),
  };
}

function checkParent(
  ydoc: Y.Doc,
  entityId: string,
  parent: string | null,
): TesseraError | undefined {
  if (parent === null) {
    return undefined;
  }
  if (parent === entityId) {
    return tesseraError("CONFLICT", "parent cycle", { id: entityId, invariant: "INV-DOC-03" });
  }
  const snapshot = fromYDoc(ydoc);
  const parentEntity = snapshot.entities[parent];
  if (parentEntity === undefined) {
    return tesseraError("NOT_FOUND", "parent does not exist", {
      id: entityId,
      parent,
      invariant: "INV-DOC-02",
    });
  }
  const visiting = new Set<string>([entityId]);
  let current: string | null = parent;
  while (current !== null) {
    if (visiting.has(current)) {
      return tesseraError("CONFLICT", "parent cycle", { id: entityId, invariant: "INV-DOC-03" });
    }
    visiting.add(current);
    const entity: Entity | undefined = snapshot.entities[current];
    if (entity === undefined) {
      return tesseraError("NOT_FOUND", "parent does not exist", {
        id: entityId,
        parent: current,
        invariant: "INV-DOC-02",
      });
    }
    current = entity.parent;
  }
  return undefined;
}
