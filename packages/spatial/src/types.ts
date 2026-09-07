import type { Asset, Entity } from "@tessera/schema";

/**
 * Document reads needed for bounds and hierarchy (`02` §4). Structurally a
 * subset of `@tessera/core` `DocumentReader`.
 *
 * @public
 */
export interface SpatialReader {
  getEntity(id: string): Entity | undefined;
  getAsset(id: string): Asset | undefined;
  parentChain(id: string): readonly Entity[];
}
