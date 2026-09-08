import { cameraSetMainCommand } from "@tessera/schema";
import { err, ok, tesseraError } from "@tessera/std";
import { defineCommand, resolveEntityRef } from "./helpers.js";

export const cameraSetMain = defineCommand(cameraSetMainCommand, {
  validate(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    if (target.value.components.camera === undefined) {
      return err(tesseraError("CONFLICT", "entity has no camera component"));
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    if (target.value.components.camera === undefined) {
      return err(tesseraError("CONFLICT", "entity has no camera component"));
    }
    const settings = ctx.doc.snapshot().settings;
    const updated = ctx.write.setSettings({ ...settings, mainCamera: target.value.id });
    if (!updated.ok) {
      return updated;
    }
    return ok({});
  },
});
