import { z } from "zod";
import type { InspectorFieldMeta } from "../inspector-field.js";
import { Vec3Schema } from "../primitives.js";

export const ColliderSchema = z.object({
  shape: z
    .enum(["box", "sphere", "capsule", "convex", "mesh"])
    .default("box")
    .meta({
      label: "Shape",
      widget: "select",
      group: "Collider",
      order: 10,
      description: "Collision shape",
    } satisfies InspectorFieldMeta),
  fit: z
    .enum(["auto", "manual"])
    .default("auto")
    .meta({
      label: "Fit",
      widget: "select",
      group: "Collider",
      order: 20,
      description: "Auto derives size from geometry bounds",
    } satisfies InspectorFieldMeta),
  size: Vec3Schema.default([1, 1, 1]).meta({
    label: "Size",
    unit: "m",
    widget: "vec3",
    group: "Collider",
    order: 30,
    description: "Box extents when fit is manual",
  } satisfies InspectorFieldMeta),
  radius: z
    .number()
    .finite()
    .positive()
    .default(0.5)
    .meta({
      label: "Radius",
      unit: "m",
      widget: "number",
      group: "Collider",
      order: 40,
      description: "Sphere or capsule radius when fit is manual",
    } satisfies InspectorFieldMeta),
  height: z
    .number()
    .finite()
    .positive()
    .default(1)
    .meta({
      label: "Height",
      unit: "m",
      widget: "number",
      group: "Collider",
      order: 50,
      description: "Capsule height including caps when fit is manual",
    } satisfies InspectorFieldMeta),
  offset: Vec3Schema.default([0, 0, 0]).meta({
    label: "Offset",
    unit: "m",
    widget: "vec3",
    group: "Collider",
    order: 60,
    description: "Local offset from the entity origin",
  } satisfies InspectorFieldMeta),
  isTrigger: z
    .boolean()
    .default(false)
    .meta({
      label: "Trigger",
      widget: "toggle",
      group: "Collider",
      order: 70,
      description: "Trigger colliders report overlap without blocking",
    } satisfies InspectorFieldMeta),
});

export type Collider = z.infer<typeof ColliderSchema>;
