import type { ComponentType, Document, Entity } from "@tessera/schema";
import {
  sceneDescribeQuery,
  sceneFindQuery,
  sceneMeasureQuery,
  sceneStatsQuery,
} from "@tessera/schema";
import { err, ok, tesseraError } from "@tessera/std";
import { resolveEntityRef, subtreeIds } from "../commands/helpers.js";
import { describeScene } from "../describe-scene.js";
import { defineQuery } from "./define.js";
import {
  aabbDiagonal,
  aabbGap,
  entityWorldAabb,
  entityWorldOrigin,
  unionAabb,
} from "./world-bounds.js";

export const sceneDescribe = defineQuery(sceneDescribeQuery, (ctx, input) => {
  return describeScene(ctx.doc, input);
});

export const sceneFind = defineQuery(sceneFindQuery, (ctx, input) => {
  const snapshot = ctx.doc.snapshot();
  let allowed: Set<string> | undefined;
  if (input.within !== undefined) {
    const resolved = resolveEntityRef(ctx.doc, input.within);
    if (!resolved.ok) {
      return resolved;
    }
    allowed = new Set(subtreeIds(ctx.doc, resolved.value.id));
  }
  const matches: { id: string; path: string }[] = [];
  const limit = input.limit;
  for (const entity of orderedEntities(ctx.doc, snapshot)) {
    if (allowed !== undefined && !allowed.has(entity.id)) {
      continue;
    }
    if (input.name !== undefined && !globMatch(entity.name, input.name)) {
      continue;
    }
    if (input.tag !== undefined && !hasTag(entity, input.tag)) {
      continue;
    }
    if (input.component !== undefined && !hasComponent(entity, input.component)) {
      continue;
    }
    const path = ctx.doc.pathOf(entity.id);
    if (path === undefined) {
      continue;
    }
    matches.push({ id: entity.id, path });
    if (limit !== undefined && matches.length >= limit) {
      break;
    }
  }
  return ok({ matches });
});

export const sceneStats = defineQuery(sceneStatsQuery, (ctx) => {
  const snapshot = ctx.doc.snapshot();
  const entities = Object.values(snapshot.entities);
  const assets = Object.values(snapshot.assets);
  let triangles = 0;
  let vertices = 0;
  for (const asset of assets) {
    if (asset.kind === "geometry") {
      triangles += asset.stats.triangles;
      vertices += asset.stats.vertices;
    }
  }
  let bounds = null;
  for (const entity of entities) {
    const box = entityWorldAabb(entity, ctx.doc);
    bounds = bounds === null ? box : unionAabb(bounds, box);
  }
  return ok({
    entityCount: entities.length,
    assetCount: assets.length,
    behaviorCount: Object.keys(snapshot.behaviors).length,
    triangles,
    vertices,
    bounds,
  });
});

export const sceneMeasure = defineQuery(sceneMeasureQuery, (ctx, input) => {
  const a = resolveEntityRef(ctx.doc, input.a);
  if (!a.ok) {
    return a;
  }
  const boxA = entityWorldAabb(a.value, ctx.doc);
  if (input.mode === "bounds" && input.b === undefined) {
    return ok({ value: aabbDiagonal(boxA) });
  }
  if (input.b === undefined) {
    return err(tesseraError("INVALID_INPUT", "scene.measure requires b for this mode"));
  }
  const b = resolveEntityRef(ctx.doc, input.b);
  if (!b.ok) {
    return b;
  }
  if (input.mode === "distance") {
    const originA = entityWorldOrigin(a.value, ctx.doc);
    const originB = entityWorldOrigin(b.value, ctx.doc);
    return ok({
      value: Math.hypot(originA[0] - originB[0], originA[1] - originB[1], originA[2] - originB[2]),
    });
  }
  const boxB = entityWorldAabb(b.value, ctx.doc);
  if (input.mode === "gap") {
    return ok({ value: aabbGap(boxA, boxB) });
  }
  return ok({ value: aabbDiagonal(unionAabb(boxA, boxB)) });
});

function orderedEntities(
  reader: { children(id: string | null): readonly Entity[] },
  snapshot: Document,
): Entity[] {
  const out: Entity[] = [];
  const walk = (parent: string | null): void => {
    for (const child of reader.children(parent)) {
      out.push(child);
      walk(child.id);
    }
  };
  walk(null);
  if (out.length === 0) {
    return Object.values(snapshot.entities);
  }
  return out;
}

function globMatch(name: string, glob: string): boolean {
  let pattern = "";
  for (const char of glob) {
    if (char === "*") {
      pattern += ".*";
    } else if (char === "?") {
      pattern += ".";
    } else {
      pattern += escapeRegex(char);
    }
  }
  return new RegExp(`^${pattern}$`, "i").test(name);
}

function escapeRegex(char: string): string {
  return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasTag(entity: Entity, tag: string): boolean {
  const tags = entity.components.tags;
  if (tags === undefined) {
    return false;
  }
  return tags.some((item) => item.toLowerCase() === tag.toLowerCase());
}

function hasComponent(entity: Entity, type: ComponentType): boolean {
  if (type === "transform") {
    return true;
  }
  return entity.components[type] !== undefined;
}
