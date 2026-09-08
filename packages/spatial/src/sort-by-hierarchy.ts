import type { EntityId } from "@tessera/schema";
import type { SpatialReader } from "./types.js";

/**
 * Topologically sorts entity ids so parents precede children (`05` §4).
 * Ids with no entity stay in relative order at the end of their component.
 *
 * @example
 * ```ts
 * sortByHierarchy([child.id, parent.id], reader);
 * ```
 *
 * @public
 */
export function sortByHierarchy(
  ids: readonly EntityId[],
  reader: SpatialReader,
): readonly EntityId[] {
  const wanted = new Set(ids);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: EntityId[] = [];

  const visit = (id: EntityId): void => {
    if (visited.has(id) || !wanted.has(id)) {
      return;
    }
    if (visiting.has(id)) {
      return;
    }
    visiting.add(id);
    const entity = reader.getEntity(id);
    const parentId = entity?.parent;
    if (parentId !== null && parentId !== undefined && wanted.has(parentId)) {
      visit(parentId);
    }
    visiting.delete(id);
    visited.add(id);
    ordered.push(id);
  };

  for (const id of ids) {
    visit(id);
  }
  return ordered;
}
