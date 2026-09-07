import { TagsSchema, tagsAddCommand, tagsRemoveCommand } from "@tessera/schema";
import { err, ok, tesseraError } from "@tessera/std";
import { defineCommand, resolveEntityRef } from "./helpers.js";

export const tagsAdd = defineCommand(tagsAddCommand, {
  validate(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    const current = target.value.components.tags ?? [];
    const next = [...current];
    for (const tag of input.tags) {
      if (!next.includes(tag)) {
        next.push(tag);
      }
    }
    const parsed = TagsSchema.safeParse(next);
    if (!parsed.success) {
      return err(tesseraError("INVALID_INPUT", "invalid tags", { issues: parsed.error.issues }));
    }
    const updated = ctx.write.updateEntity({
      ...target.value,
      components: { ...target.value.components, tags: parsed.data },
    });
    if (!updated.ok) {
      return updated;
    }
    return ok({ tags: parsed.data });
  },
});

export const tagsRemove = defineCommand(tagsRemoveCommand, {
  validate(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    const remove = new Set(input.tags);
    const current = target.value.components.tags ?? [];
    const next = current.filter((tag) => !remove.has(tag));
    const components = { ...target.value.components };
    if (next.length === 0) {
      delete components.tags;
    } else {
      components.tags = next;
    }
    const updated = ctx.write.updateEntity({ ...target.value, components });
    if (!updated.ok) {
      return updated;
    }
    return ok({ tags: next });
  },
});
