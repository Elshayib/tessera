import type { Asset, Behavior, Document, Entity } from "@tessera/schema";
import type { Clock, Logger } from "@tessera/std";
import type * as Y from "yjs";

/**
 * Live Yjs document plus injected clock and logger.
 *
 * @public
 */
export interface DocumentHandle {
  readonly ydoc: Y.Doc;
  readonly clock: Clock;
  readonly logger: Logger;
}

/**
 * Read API for the live document (`docs/04-command-bus.md`).
 *
 * @public
 */
export interface DocumentReader {
  getEntity(id: string): Entity | undefined;
  getAsset(id: string): Asset | undefined;
  getBehavior(id: string): Behavior | undefined;
  children(id: string | null): readonly Entity[];
  parentChain(id: string): readonly Entity[];
  resolvePath(path: string): Entity | undefined;
  pathOf(id: string): string | undefined;
  entities(): IterableIterator<Entity>;
  assets(kind?: Asset["kind"]): IterableIterator<Asset>;
  snapshot(): Document;
  subscribe(listener: () => void): () => void;
}
