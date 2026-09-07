import { entityChildrenQuery, entityGetQuery } from "@tessera/schema";
import { ok } from "@tessera/std";
import { resolveEntityRef } from "../commands/helpers.js";
import { defineQuery } from "./define.js";

export const entityGet = defineQuery(entityGetQuery, (ctx, input) => {
  const resolved = resolveEntityRef(ctx.doc, input.target);
  if (!resolved.ok) {
    return resolved;
  }
  if (input.includeChildren === true) {
    return ok({
      entity: resolved.value,
      children: ctx.doc.children(resolved.value.id).map((child) => child.id),
    });
  }
  return ok({ entity: resolved.value });
});

export const entityChildren = defineQuery(entityChildrenQuery, (ctx, input) => {
  if (input.target === null) {
    return ok(ctx.doc.children(null).map((child) => child.id));
  }
  const resolved = resolveEntityRef(ctx.doc, input.target);
  if (!resolved.ok) {
    return resolved;
  }
  return ok(ctx.doc.children(resolved.value.id).map((child) => child.id));
});
