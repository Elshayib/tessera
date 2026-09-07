import { settingsSetCommand } from "@tessera/schema";
import { ok } from "@tessera/std";
import { defineCommand, resolveEntityRef } from "./helpers.js";

export const settingsSet = defineCommand(settingsSetCommand, {
  validate(ctx, input) {
    if (input.patch.mainCamera !== undefined && input.patch.mainCamera !== null) {
      const camera = resolveEntityRef(ctx.doc, input.patch.mainCamera);
      if (!camera.ok) {
        return camera;
      }
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const current = ctx.doc.snapshot().settings;
    let mainCamera = current.mainCamera;
    if (input.patch.mainCamera !== undefined) {
      if (input.patch.mainCamera === null) {
        mainCamera = null;
      } else {
        const camera = resolveEntityRef(ctx.doc, input.patch.mainCamera);
        if (!camera.ok) {
          return camera;
        }
        mainCamera = camera.value.id;
      }
    }
    const physics = input.patch.physics ?? current.physics;
    const updated = ctx.write.setSettings({ ...current, mainCamera, physics });
    if (!updated.ok) {
      return updated;
    }
    return ok({});
  },
});
