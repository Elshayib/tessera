import { z } from "zod";
import type { InspectorFieldMeta } from "../inspector-field.js";

export const CameraFieldsSchema = z.object({
  type: z
    .enum(["perspective", "orthographic"])
    .default("perspective")
    .meta({
      label: "Type",
      widget: "select",
      group: "Lens",
      order: 10,
      description: "Projection type",
    } satisfies InspectorFieldMeta),
  fov: z
    .number()
    .finite()
    .gt(1)
    .lt(179)
    .default(50)
    .meta({
      label: "Field of view",
      unit: "°",
      step: 1,
      widget: "slider",
      group: "Lens",
      order: 10,
      description: "Vertical field of view",
    } satisfies InspectorFieldMeta),
  near: z
    .number()
    .finite()
    .positive()
    .default(0.1)
    .meta({
      label: "Near",
      unit: "m",
      widget: "number",
      group: "Lens",
      order: 20,
      description: "Near clip plane",
    } satisfies InspectorFieldMeta),
  far: z
    .number()
    .finite()
    .positive()
    .default(1000)
    .meta({
      label: "Far",
      unit: "m",
      widget: "number",
      group: "Lens",
      order: 30,
      description: "Far clip plane",
    } satisfies InspectorFieldMeta),
  orthoSize: z
    .number()
    .finite()
    .positive()
    .default(5)
    .meta({
      label: "Ortho size",
      unit: "m",
      widget: "number",
      group: "Lens",
      order: 40,
      description: "Orthographic half-height",
    } satisfies InspectorFieldMeta),
});

export const CameraSchema = CameraFieldsSchema.refine((value) => value.far > value.near, {
  message: "far must be greater than near",
});

export type Camera = z.infer<typeof CameraSchema>;
