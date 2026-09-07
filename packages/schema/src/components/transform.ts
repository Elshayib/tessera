import { z } from "zod";
import type { InspectorFieldMeta } from "../inspector-field.js";
import { Vec3Schema } from "../primitives.js";

export const TransformSchema = z.object({
  position: Vec3Schema.default([0, 0, 0]).meta({
    label: "Position",
    unit: "m",
    widget: "vec3",
    group: "Transform",
    order: 10,
    description: "Local translation",
  } satisfies InspectorFieldMeta),
  rotation: Vec3Schema.default([0, 0, 0]).meta({
    label: "Rotation",
    unit: "°",
    widget: "vec3",
    group: "Transform",
    order: 20,
    description: "Local Euler XYZ rotation",
  } satisfies InspectorFieldMeta),
  scale: z
    .tuple([
      z.number().finite().positive(),
      z.number().finite().positive(),
      z.number().finite().positive(),
    ])
    .default([1, 1, 1])
    .meta({
      label: "Scale",
      widget: "vec3",
      group: "Transform",
      order: 30,
      description: "Per-axis scale; each component must be positive",
    } satisfies InspectorFieldMeta),
});

export type Transform = z.infer<typeof TransformSchema>;
