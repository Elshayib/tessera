import type { Asset, Document, Entity } from "@tessera/schema";
import type { Logger } from "@tessera/std";
import type { Scene } from "three";

/**
 * Document reads needed to apply a change set. Structurally a subset of core `DocumentReader`.
 *
 * @public
 */
export interface SyncReader {
  getEntity(id: string): Entity | undefined;
  getAsset(id: string): Asset | undefined;
  children(id: string | null): readonly Entity[];
  parentChain(id: string): readonly Entity[];
  snapshot(): Document;
}

/**
 * Change-set shape consumed by renderer sync (`04` §7). Ids only; engine never writes the document.
 *
 * @public
 */
export interface SyncChangeSet {
  readonly entities: {
    readonly created: readonly string[];
    readonly deleted: readonly { readonly id: string }[];
    readonly updated: readonly { readonly id: string }[];
  };
  readonly assets: {
    readonly created: readonly string[];
    readonly deleted: readonly { readonly id: string }[];
    readonly updated: readonly { readonly id: string }[];
  };
}

/**
 * Shared state for component handlers (`05` §4.2).
 *
 * @public
 */
export interface SyncContext {
  readonly scene: Scene;
  readonly reader: SyncReader;
  markDirty(): void;
  readonly logger: Logger;
}

/**
 * Incremental document→scene mirror (`05` §4).
 *
 * @public
 */
export interface RendererSync {
  apply(changeSet: SyncChangeSet, reader: SyncReader): void;
  rebuild(reader: SyncReader): void;
  structuralHash(): string;
  dispose(): void;
}
