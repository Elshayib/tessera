import {
  CameraSchema,
  ColliderSchema,
  componentAddCommand,
  componentRemoveCommand,
  componentSetCommand,
  LightSchema,
  MeshRendererSchema,
  MetadataSchema,
  RigidBodySchema,
  TagsSchema,
  TransformSchema,
} from "@tessera/schema";
import { err, ok, tesseraError } from "@tessera/std";
import { defineCommand, mergeDeep, resolveEntityRef } from "./helpers.js";

export const componentAdd = defineCommand(componentAddCommand, {
  validate(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    const existing = target.value.components[input.type];
    if (existing !== undefined) {
      return err(tesseraError("CONFLICT", "component already present", { type: input.type }));
    }
    if (input.type === "rigidBody" && target.value.components.collider === undefined) {
      return err(tesseraError("CONFLICT", "rigidBody requires collider"));
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    const components = { ...target.value.components };
    switch (input.type) {
      case "transform":
        components.transform = TransformSchema.parse(input.value ?? {});
        break;
      case "meshRenderer":
        components.meshRenderer = MeshRendererSchema.parse(input.value ?? {});
        break;
      case "light":
        components.light = LightSchema.parse({ type: "directional", ...input.value });
        break;
      case "camera":
        components.camera = CameraSchema.parse(input.value ?? {});
        break;
      case "collider":
        components.collider = ColliderSchema.parse(input.value ?? {});
        break;
      case "rigidBody":
        components.rigidBody = RigidBodySchema.parse(input.value ?? {});
        break;
      case "tags":
        components.tags = TagsSchema.parse(input.value ?? []);
        break;
      case "metadata":
        components.metadata = MetadataSchema.parse(input.value ?? {});
        break;
    }
    const updated = ctx.write.updateEntity({ ...target.value, components });
    if (!updated.ok) {
      return updated;
    }
    return ok({});
  },
});

export const componentRemove = defineCommand(componentRemoveCommand, {
  validate(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    if (input.type === "transform") {
      return err(tesseraError("CONFLICT", "transform cannot be removed"));
    }
    if (target.value.components[input.type] === undefined) {
      return err(tesseraError("NOT_FOUND", "component missing", { type: input.type }));
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    const components = { ...target.value.components };
    if (input.type === "collider") {
      delete components.collider;
      delete components.rigidBody;
    } else if (input.type === "meshRenderer") {
      delete components.meshRenderer;
    } else if (input.type === "light") {
      delete components.light;
    } else if (input.type === "camera") {
      delete components.camera;
    } else if (input.type === "rigidBody") {
      delete components.rigidBody;
    } else if (input.type === "tags") {
      delete components.tags;
    } else if (input.type === "metadata") {
      delete components.metadata;
    } else {
      return err(tesseraError("CONFLICT", "transform cannot be removed"));
    }
    const updated = ctx.write.updateEntity({ ...target.value, components });
    if (!updated.ok) {
      return updated;
    }
    return ok({});
  },
});

export const componentSet = defineCommand(componentSetCommand, {
  validate(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    if (target.value.components[input.type] === undefined) {
      return err(tesseraError("NOT_FOUND", "component missing", { type: input.type }));
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    const components = { ...target.value.components };
    const current = components[input.type];
    const merged = mergeDeep(current, input.patch);
    switch (input.type) {
      case "transform":
        components.transform = TransformSchema.parse(merged);
        break;
      case "meshRenderer":
        components.meshRenderer = MeshRendererSchema.parse(merged);
        break;
      case "light":
        components.light = LightSchema.parse(merged);
        break;
      case "camera":
        components.camera = CameraSchema.parse(merged);
        break;
      case "collider":
        components.collider = ColliderSchema.parse(merged);
        break;
      case "rigidBody":
        components.rigidBody = RigidBodySchema.parse(merged);
        break;
      case "tags":
        components.tags = TagsSchema.parse(input.patch);
        break;
      case "metadata":
        components.metadata = MetadataSchema.parse(merged);
        break;
    }
    const updated = ctx.write.updateEntity({ ...target.value, components });
    if (!updated.ok) {
      return updated;
    }
    return ok({});
  },
});
