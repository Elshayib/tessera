import type { Entity, Transform, Vec3 } from "@tessera/schema";
import {
  TransformSchema,
  transformRotateCommand,
  transformScaleCommand,
  transformSetCommand,
  transformTranslateCommand,
} from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import type { WriteContext } from "../command-types.js";
import {
  composeTrs,
  decomposeTrs,
  keepWorldLocal,
  multiplyMat4,
  transformDir,
} from "../internal/math.js";
import {
  addVec3,
  defineCommand,
  entityWorldMatrix,
  normalizeEuler,
  parentWorldMatrix,
  resolveEntityRef,
  scaleVec3,
} from "./helpers.js";

function setTransform(
  ctx: WriteContext,
  entity: Entity,
  transform: Transform,
): Result<Transform, TesseraError> {
  const parsed = TransformSchema.parse(transform);
  const updated = ctx.write.updateEntity({
    ...entity,
    components: { ...entity.components, transform: parsed },
  });
  if (!updated.ok) {
    return updated;
  }
  return ok(parsed);
}

export const transformSet = defineCommand(transformSetCommand, {
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
    const current = target.value.components.transform;
    const written = setTransform(ctx, target.value, {
      position: input.position ?? current.position,
      rotation: input.rotation ?? current.rotation,
      scale: input.scale ?? current.scale,
    });
    if (!written.ok) {
      return written;
    }
    return ok({ transform: written.value });
  },
});

export const transformTranslate = defineCommand(transformTranslateCommand, {
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
    const space = input.space ?? "parent";
    const current = target.value.components.transform;
    if (space === "world") {
      const world = entityWorldMatrix(target.value, ctx.doc);
      const decomposed = decomposeTrs(world);
      const moved = composeTrs(
        addVec3(decomposed.position, input.delta),
        decomposed.rotation,
        decomposed.scale,
      );
      const local = keepWorldLocal(moved, parentWorldMatrix(target.value, ctx.doc));
      if (local === undefined) {
        return err(tesseraError("CONFLICT", "cannot invert parent transform"));
      }
      const written = setTransform(ctx, target.value, {
        position: [local.position[0], local.position[1], local.position[2]],
        rotation: [local.rotation[0], local.rotation[1], local.rotation[2]],
        scale: [local.scale[0], local.scale[1], local.scale[2]],
      });
      if (!written.ok) {
        return written;
      }
      return ok({ transform: written.value });
    }
    const position =
      space === "local"
        ? addVec3(
            current.position,
            transformDir(composeTrs([0, 0, 0], current.rotation, [1, 1, 1]), input.delta),
          )
        : addVec3(current.position, input.delta);
    const written = setTransform(ctx, target.value, { ...current, position });
    if (!written.ok) {
      return written;
    }
    return ok({ transform: written.value });
  },
});

export const transformRotate = defineCommand(transformRotateCommand, {
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
    const space = input.space ?? "parent";
    const current = target.value.components.transform;
    if (space === "world") {
      const world = entityWorldMatrix(target.value, ctx.doc);
      const decomposed = decomposeTrs(world);
      const nextWorld = multiplyMat4(
        composeTrs([0, 0, 0], input.delta, [1, 1, 1]),
        composeTrs(decomposed.position, decomposed.rotation, decomposed.scale),
      );
      const local = keepWorldLocal(nextWorld, parentWorldMatrix(target.value, ctx.doc));
      if (local === undefined) {
        return err(tesseraError("CONFLICT", "cannot invert parent transform"));
      }
      const written = setTransform(ctx, target.value, {
        position: [local.position[0], local.position[1], local.position[2]],
        rotation: normalizeEuler([local.rotation[0], local.rotation[1], local.rotation[2]]),
        scale: [local.scale[0], local.scale[1], local.scale[2]],
      });
      if (!written.ok) {
        return written;
      }
      return ok({ transform: written.value });
    }
    const currentM = composeTrs([0, 0, 0], current.rotation, [1, 1, 1]);
    const deltaM = composeTrs([0, 0, 0], input.delta, [1, 1, 1]);
    const combined =
      space === "local" ? multiplyMat4(currentM, deltaM) : multiplyMat4(deltaM, currentM);
    const rotation = normalizeEuler(decomposeTrs(combined).rotation);
    const written = setTransform(ctx, target.value, { ...current, rotation });
    if (!written.ok) {
      return written;
    }
    return ok({ transform: written.value });
  },
});

export const transformScale = defineCommand(transformScaleCommand, {
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
    const current = target.value.components.transform;
    const factor: Vec3 =
      typeof input.factor === "number" ? [input.factor, input.factor, input.factor] : input.factor;
    const scaled = scaleVec3(current.scale, factor);
    if (!scaled.ok) {
      return scaled;
    }
    const written = setTransform(ctx, target.value, { ...current, scale: scaled.value });
    if (!written.ok) {
      return written;
    }
    return ok({ transform: written.value });
  },
});
