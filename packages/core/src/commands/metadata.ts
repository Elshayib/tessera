import { MetadataSchema, metadataSetCommand } from "@tessera/schema";
import { err, ok, tesseraError } from "@tessera/std";
import { defineCommand, resolveEntityRef } from "./helpers.js";

export const metadataSet = defineCommand(metadataSetCommand, {
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
    const current: Record<string, unknown> = { ...(target.value.components.metadata ?? {}) };
    for (const [key, value] of Object.entries(input.patch)) {
      if (value === null) {
        delete current[key];
      } else {
        current[key] = value;
      }
    }
    const parsed = MetadataSchema.safeParse(current);
    if (!parsed.success) {
      return err(
        tesseraError("INVALID_INPUT", "invalid metadata", { issues: parsed.error.issues }),
      );
    }
    const components = { ...target.value.components };
    if (Object.keys(parsed.data).length === 0) {
      delete components.metadata;
    } else {
      components.metadata = parsed.data;
    }
    const updated = ctx.write.updateEntity({ ...target.value, components });
    if (!updated.ok) {
      return updated;
    }
    return ok({});
  },
});
