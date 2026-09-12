import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import type { AssetSource } from "./polyhaven.js";

/**
 * Lookup of built-in and injected {@link AssetSource}s (`08` §10).
 *
 * @public
 */
export interface AssetSourceRegistry {
  register(source: AssetSource): void;
  get(id: string): AssetSource | undefined;
  list(): readonly AssetSource[];
}

/**
 * In-memory {@link AssetSourceRegistry}.
 *
 * @example
 * ```ts
 * const sources = createAssetSourceRegistry();
 * sources.register(polyhaven);
 * ```
 *
 * @public
 */
export function createAssetSourceRegistry(
  initial: readonly AssetSource[] = [],
): AssetSourceRegistry {
  const map = new Map<string, AssetSource>();
  for (const source of initial) {
    map.set(source.descriptor.id, source);
  }
  return {
    register(source) {
      map.set(source.descriptor.id, source);
    },
    get(id) {
      return map.get(id);
    },
    list() {
      return [...map.values()];
    },
  };
}

/**
 * Resolves a source or `NOT_FOUND`.
 *
 * @public
 */
export function requireSource(
  registry: AssetSourceRegistry,
  sourceId: string,
): Result<AssetSource, TesseraError> {
  const source = registry.get(sourceId);
  if (source === undefined) {
    return err(tesseraError("NOT_FOUND", "asset source not found", { sourceId }));
  }
  return ok(source);
}
