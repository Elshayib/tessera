import type { Aabb, Entity, EntityRef, Vec3 } from "@tessera/schema";
import {
  layoutAlignToCommand,
  layoutArrangeGridCommand,
  layoutDistributeCommand,
  layoutLookAtCommand,
  layoutPlaceOnCommand,
  layoutResolveOverlapsCommand,
  layoutScatterCommand,
  layoutSnapToGroundCommand,
} from "@tessera/schema";
import {
  aabbCenter,
  alignToDelta,
  arrangeGridPositions,
  distributeCenters,
  hashString,
  lookAtEuler,
  mulberry32,
  placeOnDelta,
  poissonDisk,
  resolveOverlaps,
  snapToGroundDelta,
  worldAabb,
} from "@tessera/spatial";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import type { WriteContext } from "../command-types.js";
import { defineCommand, resolveEntityRef } from "./helpers.js";

function boxOf(
  ctx: WriteContext,
  ref: EntityRef,
): Result<{ entity: Entity; box: Aabb }, TesseraError> {
  const entity = resolveEntityRef(ctx.doc, ref);
  if (!entity.ok) {
    return entity;
  }
  return ok({ entity: entity.value, box: worldAabb(entity.value, ctx.doc) });
}

function translateWorld(
  ctx: WriteContext,
  target: string,
  delta: Vec3,
): Result<unknown, TesseraError> {
  if (Math.abs(delta[0]) < 1e-10 && Math.abs(delta[1]) < 1e-10 && Math.abs(delta[2]) < 1e-10) {
    return ok({});
  }
  return ctx.run("transform.translate", { target, delta, space: "world" });
}

function groundY(
  ctx: WriteContext,
  ground: EntityRef | "y0" | undefined,
): Result<number, TesseraError> {
  if (ground === undefined || ground === "y0") {
    return ok(0);
  }
  const surface = boxOf(ctx, ground);
  if (!surface.ok) {
    return surface;
  }
  return ok(surface.value.box.max[1]);
}

function duplicateIds(value: unknown): Result<readonly string[], TesseraError> {
  if (typeof value !== "object" || value === null || !("ids" in value)) {
    return err(tesseraError("INVARIANT_VIOLATION", "entity.duplicate missing ids"));
  }
  const ids = value.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    return err(tesseraError("INVARIANT_VIOLATION", "entity.duplicate missing ids"));
  }
  return ok(ids);
}

function isVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    typeof value[2] === "number"
  );
}

export const layoutPlaceOn = defineCommand(layoutPlaceOnCommand, {
  validate(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    const surface = resolveEntityRef(ctx.doc, input.surface);
    if (!surface.ok) {
      return surface;
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const target = boxOf(ctx, input.target);
    if (!target.ok) {
      return target;
    }
    const surface = boxOf(ctx, input.surface);
    if (!surface.ok) {
      return surface;
    }
    const seed = hashString(`${target.value.entity.id}:${surface.value.entity.id}`);
    const delta = placeOnDelta(target.value.box, surface.value.box, {
      random: mulberry32(seed),
      ...(input.anchor === undefined ? {} : { anchor: input.anchor }),
      ...(input.margin === undefined ? {} : { margin: input.margin }),
    });
    const moved = translateWorld(ctx, target.value.entity.id, delta);
    if (!moved.ok) {
      return moved;
    }
    return ok({});
  },
});

export const layoutSnapToGround = defineCommand(layoutSnapToGroundCommand, {
  validate(ctx, input) {
    for (const ref of input.targets) {
      const target = resolveEntityRef(ctx.doc, ref);
      if (!target.ok) {
        return target;
      }
    }
    if (input.ground !== undefined && input.ground !== "y0") {
      const ground = resolveEntityRef(ctx.doc, input.ground);
      if (!ground.ok) {
        return ground;
      }
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const y = groundY(ctx, input.ground);
    if (!y.ok) {
      return y;
    }
    for (const ref of input.targets) {
      const target = boxOf(ctx, ref);
      if (!target.ok) {
        return target;
      }
      const moved = translateWorld(
        ctx,
        target.value.entity.id,
        snapToGroundDelta(target.value.box, y.value),
      );
      if (!moved.ok) {
        return moved;
      }
    }
    return ok({});
  },
});

export const layoutAlignTo = defineCommand(layoutAlignToCommand, {
  validate(ctx, input) {
    const reference = resolveEntityRef(ctx.doc, input.reference);
    if (!reference.ok) {
      return reference;
    }
    for (const ref of input.targets) {
      const target = resolveEntityRef(ctx.doc, ref);
      if (!target.ok) {
        return target;
      }
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const reference = boxOf(ctx, input.reference);
    if (!reference.ok) {
      return reference;
    }
    for (const ref of input.targets) {
      const target = boxOf(ctx, ref);
      if (!target.ok) {
        return target;
      }
      const moved = translateWorld(
        ctx,
        target.value.entity.id,
        alignToDelta(target.value.box, reference.value.box, input.axes, input.mode),
      );
      if (!moved.ok) {
        return moved;
      }
    }
    return ok({});
  },
});

export const layoutDistribute = defineCommand(layoutDistributeCommand, {
  validate(ctx, input) {
    for (const ref of input.targets) {
      const target = resolveEntityRef(ctx.doc, ref);
      if (!target.ok) {
        return target;
      }
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const boxes: { id: string; box: Aabb }[] = [];
    for (const ref of input.targets) {
      const target = boxOf(ctx, ref);
      if (!target.ok) {
        return target;
      }
      boxes.push({ id: target.value.entity.id, box: target.value.box });
    }
    const centers = boxes.map((entry) => aabbCenter(entry.box));
    const next = distributeCenters(centers, input.axis, input.spacing, input.from, input.to);
    for (let index = 0; index < boxes.length; index += 1) {
      const entry = boxes[index];
      const dest = next[index];
      if (entry === undefined || dest === undefined) {
        continue;
      }
      const current = aabbCenter(entry.box);
      const moved = translateWorld(ctx, entry.id, [
        dest[0] - current[0],
        dest[1] - current[1],
        dest[2] - current[2],
      ]);
      if (!moved.ok) {
        return moved;
      }
    }
    return ok({});
  },
});

export const layoutArrangeGrid = defineCommand(layoutArrangeGridCommand, {
  validate(ctx, input) {
    for (const ref of input.targets) {
      const target = resolveEntityRef(ctx.doc, ref);
      if (!target.ok) {
        return target;
      }
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const positions = arrangeGridPositions(
      input.targets.length,
      input.columns,
      input.spacing,
      input.origin,
      input.plane,
    );
    for (let index = 0; index < input.targets.length; index += 1) {
      const ref = input.targets[index];
      const dest = positions[index];
      if (ref === undefined || dest === undefined) {
        continue;
      }
      const target = boxOf(ctx, ref);
      if (!target.ok) {
        return target;
      }
      const current = aabbCenter(target.value.box);
      const moved = translateWorld(ctx, target.value.entity.id, [
        dest[0] - current[0],
        dest[1] - current[1],
        dest[2] - current[2],
      ]);
      if (!moved.ok) {
        return moved;
      }
    }
    return ok({});
  },
});

export const layoutScatter = defineCommand(layoutScatterCommand, {
  validate(ctx, input) {
    const template = resolveEntityRef(ctx.doc, input.template);
    if (!template.ok) {
      return template;
    }
    const surface = resolveEntityRef(ctx.doc, input.surface);
    if (!surface.ok) {
      return surface;
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const template = boxOf(ctx, input.template);
    if (!template.ok) {
      return template;
    }
    const surface = boxOf(ctx, input.surface);
    if (!surface.ok) {
      return surface;
    }
    const samples = poissonDisk(
      [surface.value.box.min[0], surface.value.box.min[2]],
      [surface.value.box.max[0], surface.value.box.max[2]],
      input.count,
      input.seed,
      input.minDistance ?? 0,
    );
    const rng = mulberry32(input.seed + 1);
    const ids: string[] = [];
    const top = surface.value.box.max[1];
    const halfY = (template.value.box.max[1] - template.value.box.min[1]) / 2;
    for (const sample of samples) {
      const duplicated = ctx.run("entity.duplicate", {
        target: template.value.entity.id,
        count: 1,
      });
      if (!duplicated.ok) {
        return duplicated;
      }
      const created = duplicateIds(duplicated.value);
      if (!created.ok) {
        return created;
      }
      const copyId = created.value[0];
      if (copyId === undefined) {
        return err(tesseraError("INVARIANT_VIOLATION", "entity.duplicate returned no id"));
      }
      ids.push(copyId);
      const copy = ctx.doc.getEntity(copyId);
      if (copy === undefined) {
        return err(tesseraError("NOT_FOUND", "duplicate missing", { id: copyId }));
      }
      const copyBox = worldAabb(copy, ctx.doc);
      const center = aabbCenter(copyBox);
      const yaw = input.randomYaw === true ? (rng() - 0.5) * 360 : 0;
      const jitter = input.scaleJitter ?? 0;
      const scaleMul = 1 + (rng() * 2 - 1) * jitter;
      const rotation =
        input.alignToNormal === true || input.randomYaw === true
          ? lookAtEuler(
              [sample[0], top + halfY, sample[1]],
              [sample[0], top + halfY, sample[1] - 1],
              [0, 1, 0],
            )
          : copy.components.transform.rotation;
      const yawed: Vec3 = [rotation[0], rotation[1] + yaw, rotation[2]];
      const scaled: Vec3 = [
        copy.components.transform.scale[0] * scaleMul,
        copy.components.transform.scale[1] * scaleMul,
        copy.components.transform.scale[2] * scaleMul,
      ];
      const set = ctx.run("transform.set", {
        target: copyId,
        rotation: yawed,
        scale: scaled,
      });
      if (!set.ok) {
        return set;
      }
      const moved = translateWorld(ctx, copyId, [
        sample[0] - center[0],
        top - copyBox.min[1],
        sample[1] - center[2],
      ]);
      if (!moved.ok) {
        return moved;
      }
    }
    return ok({ ids });
  },
});

export const layoutLookAt = defineCommand(layoutLookAtCommand, {
  validate(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    if (!isVec3(input.point)) {
      const point = resolveEntityRef(ctx.doc, input.point);
      if (!point.ok) {
        return point;
      }
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const target = boxOf(ctx, input.target);
    if (!target.ok) {
      return target;
    }
    let point: Vec3;
    if (isVec3(input.point)) {
      point = input.point;
    } else {
      const resolved = boxOf(ctx, input.point);
      if (!resolved.ok) {
        return resolved;
      }
      point = aabbCenter(resolved.value.box);
    }
    const from = aabbCenter(target.value.box);
    const rotation = lookAtEuler(from, point, input.up ?? [0, 1, 0]);
    const set = ctx.run("transform.set", { target: target.value.entity.id, rotation });
    if (!set.ok) {
      return set;
    }
    return ok({});
  },
});

export const layoutResolveOverlaps = defineCommand(layoutResolveOverlapsCommand, {
  validate(ctx, input) {
    for (const ref of input.targets) {
      const target = resolveEntityRef(ctx.doc, ref);
      if (!target.ok) {
        return target;
      }
    }
    if (input.ground !== undefined && input.ground !== "y0") {
      const ground = resolveEntityRef(ctx.doc, input.ground);
      if (!ground.ok) {
        return ground;
      }
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const boxes: { id: string; box: Aabb }[] = [];
    for (const ref of input.targets) {
      const target = boxOf(ctx, ref);
      if (!target.ok) {
        return target;
      }
      boxes.push({ id: target.value.entity.id, box: target.value.box });
    }
    const resolved = resolveOverlaps(
      boxes.map((entry) => entry.box),
      input.iterations,
    );
    if (!resolved.ok) {
      return resolved;
    }
    for (let index = 0; index < boxes.length; index += 1) {
      const entry = boxes[index];
      const delta = resolved.value[index];
      if (entry === undefined || delta === undefined) {
        continue;
      }
      const moved = translateWorld(ctx, entry.id, delta);
      if (!moved.ok) {
        return moved;
      }
    }
    if (input.ground !== undefined) {
      const y = groundY(ctx, input.ground);
      if (!y.ok) {
        return y;
      }
      for (const entry of boxes) {
        const entity = ctx.doc.getEntity(entry.id);
        if (entity === undefined) {
          return err(tesseraError("NOT_FOUND", "entity missing", { id: entry.id }));
        }
        const moved = translateWorld(
          ctx,
          entry.id,
          snapToGroundDelta(worldAabb(entity, ctx.doc), y.value),
        );
        if (!moved.ok) {
          return moved;
        }
      }
    }
    return ok({});
  },
});
