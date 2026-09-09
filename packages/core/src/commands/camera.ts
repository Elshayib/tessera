import type { Aabb } from "@tessera/schema";
import { cameraFitCommand, cameraSetMainCommand } from "@tessera/schema";
import { cameraFitPose, frameBounds, worldAabb } from "@tessera/spatial";
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

export const cameraFit = defineCommand(cameraFitCommand, {
  validate(ctx, input) {
    const camera = resolveEntityRef(ctx.doc, input.camera);
    if (!camera.ok) {
      return camera;
    }
    if (camera.value.components.camera === undefined) {
      return err(tesseraError("CONFLICT", "entity has no camera component"));
    }
    if (input.targets !== "all") {
      for (const ref of input.targets) {
        const target = resolveEntityRef(ctx.doc, ref);
        if (!target.ok) {
          return target;
        }
      }
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const camera = resolveEntityRef(ctx.doc, input.camera);
    if (!camera.ok) {
      return camera;
    }
    if (camera.value.components.camera === undefined) {
      return err(tesseraError("CONFLICT", "entity has no camera component"));
    }
    const targets: Aabb[] = [];
    if (input.targets === "all") {
      for (const entity of ctx.doc.entities()) {
        if (entity.id !== camera.value.id) {
          targets.push(worldAabb(entity, ctx.doc));
        }
      }
    } else {
      for (const ref of input.targets) {
        const entity = resolveEntityRef(ctx.doc, ref);
        if (!entity.ok) {
          return entity;
        }
        targets.push(worldAabb(entity.value, ctx.doc));
      }
    }
    const framed = frameBounds(targets, input.padding);
    if (!framed.ok) {
      return framed;
    }
    const pose = cameraFitPose(
      framed.value,
      {
        position: camera.value.components.transform.position,
        rotation: camera.value.components.transform.rotation,
      },
      input.direction,
    );
    const set = ctx.run("transform.set", {
      target: camera.value.id,
      position: pose.position,
      rotation: pose.rotation,
    });
    if (!set.ok) {
      return set;
    }
    return ok({});
  },
});
