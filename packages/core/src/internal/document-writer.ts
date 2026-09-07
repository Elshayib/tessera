import type { Asset, Entity } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import * as Y from "yjs";
import type { DocumentHandle } from "../document-types.js";
import { assetsMap, entitiesMap, fromYDoc, writeAssetMap, writeEntityMap } from "../yjs-mapping.js";

/**
 * Internal writer for entity and asset maps. Not exported from the package index.
 *
 * @internal
 */
interface DocumentWriter {
  createEntity(entity: Entity): Result<void, TesseraError>;
  updateEntity(entity: Entity): Result<void, TesseraError>;
  deleteEntity(id: string): Result<void, TesseraError>;
  createAsset(asset: Asset): Result<void, TesseraError>;
  updateAsset(asset: Asset): Result<void, TesseraError>;
  deleteAsset(id: string): Result<void, TesseraError>;
}

/**
 * Test-only writer for a live document handle.
 *
 * @internal
 */
export function createTestWriter(doc: DocumentHandle): DocumentWriter {
  const ydoc = doc.ydoc;

  const createEntity = (entity: Entity): Result<void, TesseraError> => {
    const entities = entitiesMap(ydoc);
    if (entities.has(entity.id)) {
      return err(tesseraError("CONFLICT", "entity already exists", { id: entity.id }));
    }
    const parentError = checkParent(ydoc, entity.id, entity.parent);
    if (parentError !== undefined) {
      return err(parentError);
    }
    ydoc.transact(() => {
      const entry = new Y.Map<unknown>();
      entities.set(entity.id, entry);
      writeEntityMap(entry, entity);
    });
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
      ydoc.transact(() => {
        const existing = entities.get(entity.id);
        const entry = existing instanceof Y.Map ? existing : new Y.Map<unknown>();
        if (!(existing instanceof Y.Map)) {
          entities.set(entity.id, entry);
        }
        writeEntityMap(entry, entity);
      });
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
      ydoc.transact(() => {
        entities.delete(id);
      });
      return ok(undefined);
    },
    createAsset(asset) {
      const assets = assetsMap(ydoc);
      if (assets.has(asset.id)) {
        return err(tesseraError("CONFLICT", "asset already exists", { id: asset.id }));
      }
      ydoc.transact(() => {
        const entry = new Y.Map<unknown>();
        assets.set(asset.id, entry);
        writeAssetMap(entry, asset);
      });
      return ok(undefined);
    },
    updateAsset(asset) {
      const assets = assetsMap(ydoc);
      if (!assets.has(asset.id)) {
        return err(tesseraError("NOT_FOUND", "asset missing", { id: asset.id }));
      }
      ydoc.transact(() => {
        const existing = assets.get(asset.id);
        const entry = existing instanceof Y.Map ? existing : new Y.Map<unknown>();
        if (!(existing instanceof Y.Map)) {
          assets.set(asset.id, entry);
        }
        writeAssetMap(entry, asset);
      });
      return ok(undefined);
    },
    deleteAsset(id) {
      const assets = assetsMap(ydoc);
      if (!assets.has(id)) {
        return err(tesseraError("NOT_FOUND", "asset missing", { id }));
      }
      ydoc.transact(() => {
        assets.delete(id);
      });
      return ok(undefined);
    },
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
