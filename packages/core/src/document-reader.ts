import type { Document, Entity } from "@tessera/schema";
import type * as Y from "yjs";
import type { DocumentReader } from "./document-types.js";
import { fromYDoc, rootMap } from "./yjs-mapping.js";

/**
 * Creates a {@link DocumentReader} over a Y.Doc.
 *
 * @public
 */
export function createDocumentReader(ydoc: Y.Doc): DocumentReader {
  const snapshot = (): Document => fromYDoc(ydoc);

  const getEntity = (id: string): Entity | undefined => snapshot().entities[id];

  const reader: DocumentReader = {
    getEntity,
    getAsset(id) {
      return snapshot().assets[id];
    },
    getBehavior(id) {
      return snapshot().behaviors[id];
    },
    children(id) {
      const entities = [...objectValues(snapshot().entities)];
      const kids = entities.filter((entity) => entity.parent === id);
      return kids.sort((a, b) => compareOrder(a.order, b.order));
    },
    parentChain(id) {
      const entities = snapshot().entities;
      const chain: Entity[] = [];
      const visiting = new Set<string>();
      let current: string | null = id;
      while (current !== null) {
        if (visiting.has(current)) {
          break;
        }
        visiting.add(current);
        const entity: Entity | undefined = entities[current];
        if (entity === undefined) {
          break;
        }
        chain.push(entity);
        current = entity.parent;
      }
      return chain;
    },
    resolvePath(path) {
      const parts = path.split("/").filter((part) => part.length > 0);
      let parent: string | null = null;
      let current: Entity | undefined;
      for (const name of parts) {
        current = reader.children(parent).find((entity) => entity.name === name);
        if (current === undefined) {
          return undefined;
        }
        parent = current.id;
      }
      return current;
    },
    pathOf(id) {
      const chain = reader.parentChain(id);
      const start = chain[0];
      if (start === undefined || start.id !== id) {
        return undefined;
      }
      return `/${[...chain]
        .reverse()
        .map((entity) => entity.name)
        .join("/")}`;
    },
    *entities() {
      yield* objectValues(snapshot().entities);
    },
    *assets(kind) {
      for (const asset of objectValues(snapshot().assets)) {
        if (kind === undefined || asset.kind === kind) {
          yield asset;
        }
      }
    },
    snapshot,
    subscribe(listener) {
      const map = rootMap(ydoc);
      const handler = (): void => {
        listener();
      };
      map.observeDeep(handler);
      return () => {
        map.unobserveDeep(handler);
      };
    },
  };
  return reader;
}

function objectValues<T>(record: Record<string, T>): T[] {
  return Object.values(record);
}

function compareOrder(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}
