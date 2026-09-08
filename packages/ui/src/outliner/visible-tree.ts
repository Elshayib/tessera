import type { DocumentReader } from "@tessera/core";
import type { Entity } from "@tessera/schema";
import { globMatch } from "./name-glob.js";

/**
 * One visible outliner row.
 *
 * @public
 */
export interface OutlinerRow {
  readonly id: string;
  readonly name: string;
  readonly depth: number;
  readonly parent: string | null;
  readonly hasChildren: boolean;
}

/**
 * Filters and search applied to the tree (`scene.find` glob + tag).
 *
 * @public
 */
export interface OutlinerFilter {
  readonly nameGlob: string;
  readonly tag: string;
}

function entityMatches(entity: Entity, filter: OutlinerFilter): boolean {
  if (filter.nameGlob.length > 0 && !globMatch(entity.name, filter.nameGlob)) {
    return false;
  }
  if (filter.tag.length > 0) {
    const tags = entity.components.tags;
    if (tags === undefined) {
      return false;
    }
    const needle = filter.tag.toLowerCase();
    if (!tags.some((tag) => tag.toLowerCase() === needle)) {
      return false;
    }
  }
  return true;
}

/**
 * Depth-first rows in sibling `order` (`entity.children`). Matching nodes keep ancestors.
 *
 * @public
 */
export function collectOutlinerRows(
  reader: DocumentReader,
  filter: OutlinerFilter,
): readonly OutlinerRow[] {
  const rows: OutlinerRow[] = [];
  walkInto(reader, null, 0, filter, rows);
  return rows;
}

function walkInto(
  reader: DocumentReader,
  parent: string | null,
  depth: number,
  filter: OutlinerFilter,
  rows: OutlinerRow[],
): boolean {
  let shown = false;
  for (const entity of reader.children(parent)) {
    const childRows: OutlinerRow[] = [];
    const childShown = walkInto(reader, entity.id, depth + 1, filter, childRows);
    const self = entityMatches(entity, filter);
    if (self || childShown) {
      shown = true;
      rows.push({
        id: entity.id,
        name: entity.name,
        depth,
        parent: entity.parent,
        hasChildren: reader.children(entity.id).length > 0,
      });
      rows.push(...childRows);
    }
  }
  return shown;
}
