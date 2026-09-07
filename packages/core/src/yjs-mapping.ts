import type { Asset, Document, Entity } from "@tessera/schema";
import { DocumentSchema } from "@tessera/schema";
import { invariant } from "@tessera/std";
import * as Y from "yjs";
import { ROOT_MAP_KEY } from "./internal/root-map.js";
import { recordFromMap, setRecord } from "./internal/y-json.js";

/**
 * Writes a document snapshot into a new Y.Doc using `03` §9.
 *
 * @public
 */
export function toYDoc(snapshot: Document): Y.Doc {
  const ydoc = new Y.Doc();
  writeSnapshot(ydoc, snapshot);
  return ydoc;
}

/**
 * Overwrites a live Y.Doc from a snapshot. Used to abort failed transactions.
 *
 * @internal
 */
export function restoreSnapshot(ydoc: Y.Doc, snapshot: Document): void {
  writeSnapshot(ydoc, snapshot);
}

/**
 * Reads a document snapshot from a Y.Doc using `03` §9.
 *
 * @public
 */
export function fromYDoc(ydoc: Y.Doc): Document {
  const root = ydoc.getMap(ROOT_MAP_KEY);
  const raw = {
    version: root.get("version"),
    meta: mapValue(root, "meta"),
    settings: mapValue(root, "settings"),
    entities: entitiesFromMap(mapOf(root, "entities")),
    assets: assetsFromMap(mapOf(root, "assets")),
    environment: mapValue(root, "environment"),
    behaviors: behaviorsFromMap(mapOf(root, "behaviors")),
  };
  const parsed = DocumentSchema.safeParse(raw);
  invariant(parsed.success, "Yjs document did not match DocumentSchema");
  return parsed.data;
}

function writeSnapshot(ydoc: Y.Doc, snapshot: Document): void {
  ydoc.transact(() => {
    const root = ydoc.getMap(ROOT_MAP_KEY);
    root.set("version", snapshot.version);
    setNamedMap(root, "meta", snapshot.meta);
    setNamedMap(root, "settings", snapshot.settings);
    setNamedMap(root, "environment", snapshot.environment);
    writeEntities(setEmptyMap(root, "entities"), snapshot.entities);
    writeAssets(setEmptyMap(root, "assets"), snapshot.assets);
    writeBehaviors(setEmptyMap(root, "behaviors"), snapshot.behaviors);
  });
}

export function writeEntityMap(target: Y.Map<unknown>, entity: Entity): void {
  target.set("id", entity.id);
  target.set("name", entity.name);
  target.set("parent", entity.parent);
  target.set("order", entity.order);
  target.set("enabled", entity.enabled);
  const components = setEmptyMap(target, "components");
  for (const [type, value] of Object.entries(entity.components)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value) || typeof value !== "object" || value === null) {
      components.set(type, value);
      continue;
    }
    setNamedMap(components, type, value);
  }
}

export function writeAssetMap(target: Y.Map<unknown>, asset: Asset): void {
  target.clear();
  setRecord(target, objectRecord(asset));
}

export function rootMap(ydoc: Y.Doc): Y.Map<unknown> {
  return ydoc.getMap(ROOT_MAP_KEY);
}

export function entitiesMap(ydoc: Y.Doc): Y.Map<unknown> {
  return mapOf(rootMap(ydoc), "entities");
}

export function assetsMap(ydoc: Y.Doc): Y.Map<unknown> {
  return mapOf(rootMap(ydoc), "assets");
}

export function behaviorsMap(ydoc: Y.Doc): Y.Map<unknown> {
  return mapOf(rootMap(ydoc), "behaviors");
}

export function writeBehaviorMap(target: Y.Map<unknown>, behavior: object): void {
  target.clear();
  setRecord(target, objectRecord(behavior));
}

export function writeNamedMap(parent: Y.Map<unknown>, key: string, value: object): void {
  const map = setEmptyMap(parent, key);
  setRecord(map, objectRecord(value));
}

function setNamedMap(parent: Y.Map<unknown>, key: string, value: object): void {
  writeNamedMap(parent, key, value);
}

function setEmptyMap(parent: Y.Map<unknown>, key: string): Y.Map<unknown> {
  const existing = parent.get(key);
  if (existing instanceof Y.Map) {
    existing.clear();
    return existing;
  }
  const created = new Y.Map<unknown>();
  parent.set(key, created);
  return created;
}

function mapOf(parent: Y.Map<unknown>, key: string): Y.Map<unknown> {
  const value = parent.get(key);
  invariant(value instanceof Y.Map, `missing Y.Map '${key}'`);
  return value;
}

function mapValue(parent: Y.Map<unknown>, key: string): Record<string, unknown> {
  return recordFromMap(mapOf(parent, key));
}

function writeEntities(map: Y.Map<unknown>, entities: Document["entities"]): void {
  for (const entity of Object.values(entities)) {
    const entry = new Y.Map<unknown>();
    map.set(entity.id, entry);
    writeEntityMap(entry, entity);
  }
}

function writeAssets(map: Y.Map<unknown>, assets: Document["assets"]): void {
  for (const asset of Object.values(assets)) {
    const entry = new Y.Map<unknown>();
    map.set(asset.id, entry);
    writeAssetMap(entry, asset);
  }
}

function writeBehaviors(map: Y.Map<unknown>, behaviors: Document["behaviors"]): void {
  for (const behavior of Object.values(behaviors)) {
    const entry = new Y.Map<unknown>();
    map.set(behavior.id, entry);
    setRecord(entry, objectRecord(behavior));
  }
}

function entitiesFromMap(map: Y.Map<unknown>): Record<string, unknown> {
  const entities: Record<string, unknown> = {};
  for (const [id, value] of map.entries()) {
    invariant(value instanceof Y.Map, `entity '${id}' is not a Y.Map`);
    const record = recordFromMap(value);
    const componentsValue = value.get("components");
    if (componentsValue instanceof Y.Map) {
      setField(record, "components", componentsFromMap(componentsValue));
    }
    entities[id] = record;
  }
  return entities;
}

function componentsFromMap(map: Y.Map<unknown>): Record<string, unknown> {
  const components: Record<string, unknown> = {};
  for (const [type, value] of map.entries()) {
    if (value instanceof Y.Map) {
      components[type] = recordFromMap(value);
    } else {
      components[type] = value;
    }
  }
  return components;
}

function assetsFromMap(map: Y.Map<unknown>): Record<string, unknown> {
  const assets: Record<string, unknown> = {};
  for (const [id, value] of map.entries()) {
    invariant(value instanceof Y.Map, `asset '${id}' is not a Y.Map`);
    assets[id] = recordFromMap(value);
  }
  return assets;
}

function behaviorsFromMap(map: Y.Map<unknown>): Record<string, unknown> {
  const behaviors: Record<string, unknown> = {};
  for (const [id, value] of map.entries()) {
    invariant(value instanceof Y.Map, `behavior '${id}' is not a Y.Map`);
    behaviors[id] = recordFromMap(value);
  }
  return behaviors;
}

function objectRecord(value: object): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    record[key] = entry;
  }
  return record;
}

function setField(record: Record<string, unknown>, name: string, value: unknown): void {
  record[name] = value;
}
