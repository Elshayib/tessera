import type { Entity } from "@tessera/schema";
import { sortByHierarchy } from "@tessera/spatial";
import type { Logger } from "@tessera/std";
import { createLogger } from "@tessera/std";
import type { Scene } from "three";
import { Group } from "three";
import { structuralHash } from "../structural-hash.js";
import { syncCamera } from "./handlers/camera.js";
import { syncLight } from "./handlers/light.js";
import { syncMesh } from "./handlers/mesh-renderer.js";
import { applyTransform } from "./handlers/transform.js";
import { ResourceCaches } from "./resources.js";
import type { RendererSync, SyncChangeSet, SyncReader } from "./types.js";

/**
 * Options for {@link createRendererSync}.
 *
 * @public
 */
export interface CreateRendererSyncOptions {
  readonly scene: Scene;
  readonly logger?: Logger;
}

/**
 * Creates an incremental document→scene mirror (`05` §4).
 *
 * @example
 * ```ts
 * const sync = createRendererSync({ scene });
 * sync.rebuild(reader);
 * ```
 *
 * @public
 */
export function createRendererSync(options: CreateRendererSyncOptions): RendererSync {
  return new RendererSyncImpl(options.scene, options.logger ?? createLogger([]));
}

class RendererSyncImpl implements RendererSync {
  readonly #scene: Scene;
  readonly #root: Group;
  readonly #groups = new Map<string, Group>();
  readonly #caches: ResourceCaches;

  constructor(scene: Scene, logger: Logger) {
    this.#scene = scene;
    this.#root = new Group();
    this.#root.userData["tesseraKind"] = "entities-root";
    scene.add(this.#root);
    this.#caches = new ResourceCaches(logger);
  }

  apply(changeSet: SyncChangeSet, reader: SyncReader): void {
    for (const id of changeSet.assets.created) {
      this.#touchAssetUsers(id, reader);
    }
    for (const change of changeSet.assets.updated) {
      this.#touchAssetUsers(change.id, reader);
    }
    const created = sortByHierarchy(changeSet.entities.created, reader);
    for (const id of created) {
      this.#syncEntity(id, reader);
    }
    for (const change of changeSet.entities.updated) {
      this.#syncEntity(change.id, reader);
    }
    this.#relink(reader);
    for (const entity of changeSet.entities.deleted) {
      this.#removeEntity(entity.id);
    }
    for (const asset of changeSet.assets.deleted) {
      this.#invalidateAsset(asset.id);
    }
  }

  rebuild(reader: SyncReader): void {
    for (const id of [...this.#groups.keys()]) {
      this.#removeEntity(id);
    }
    const snapshot = reader.snapshot();
    this.apply(
      {
        entities: {
          created: Object.keys(snapshot.entities),
          deleted: [],
          updated: [],
        },
        assets: {
          created: Object.keys(snapshot.assets),
          deleted: [],
          updated: [],
        },
      },
      reader,
    );
  }

  structuralHash(): string {
    return structuralHash(this.#root);
  }

  dispose(): void {
    for (const id of [...this.#groups.keys()]) {
      this.#removeEntity(id);
    }
    this.#caches.dispose();
    this.#scene.remove(this.#root);
  }

  #syncEntity(id: string, reader: SyncReader): void {
    const entity = reader.getEntity(id);
    if (entity === undefined) {
      this.#removeEntity(id);
      return;
    }
    const group = this.#groups.get(id) ?? this.#makeGroup(entity);
    applyTransform(group, entity.components.transform);
    group.visible = entity.enabled;
    group.matrixAutoUpdate = false;
    syncMesh(group, entity.components.meshRenderer, this.#caches, (assetId) =>
      reader.getAsset(assetId),
    );
    syncLight(group, entity.components.light);
    syncCamera(group, entity.components.camera);
  }

  #makeGroup(entity: Entity): Group {
    const group = new Group();
    group.userData["entityId"] = entity.id;
    group.userData["tesseraKind"] = "entity";
    group.matrixAutoUpdate = false;
    this.#groups.set(entity.id, group);
    this.#root.add(group);
    return group;
  }

  #relink(reader: SyncReader): void {
    for (const [id, group] of this.#groups) {
      const entity = reader.getEntity(id);
      if (entity === undefined) {
        continue;
      }
      const parentId = entity.parent;
      const parent = parentId === null ? this.#root : this.#groups.get(parentId);
      if (parent === undefined) {
        continue;
      }
      if (group.parent !== parent) {
        parent.add(group);
      }
    }
    this.#orderChildren(null, reader, this.#root);
    for (const [id, group] of this.#groups) {
      this.#orderChildren(id, reader, group);
    }
  }

  #orderChildren(parentId: string | null, reader: SyncReader, parent: Group): void {
    const wanted = reader.children(parentId).map((entity) => entity.id);
    for (const id of wanted) {
      const child = this.#groups.get(id);
      if (child !== undefined) {
        parent.add(child);
      }
    }
  }

  #removeEntity(id: string): void {
    const group = this.#groups.get(id);
    if (group === undefined) {
      return;
    }
    syncMesh(group, undefined, this.#caches, () => undefined);
    syncLight(group, undefined);
    syncCamera(group, undefined);
    group.removeFromParent();
    this.#groups.delete(id);
  }

  #invalidateAsset(id: string): void {
    this.#caches.releaseGeometry(id);
    this.#caches.releaseMaterial(id);
  }

  #touchAssetUsers(assetId: string, reader: SyncReader): void {
    for (const entity of Object.values(reader.snapshot().entities)) {
      const mesh = entity.components.meshRenderer;
      if (mesh === undefined) {
        continue;
      }
      if (mesh.geometry === assetId || mesh.materials.includes(assetId)) {
        this.#syncEntity(entity.id, reader);
      }
    }
  }
}
