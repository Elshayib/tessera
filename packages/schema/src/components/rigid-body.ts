import { z } from "zod";
import type { InspectorFieldMeta } from "../inspector-field.js";

export const RigidBodySchema = z.object({
  type: z
    .enum(["static", "dynamic", "kinematic"])
    .default("static")
    .meta({
      label: "Type",
      widget: "select",
      group: "Rigid body",
      order: 10,
      description: "Body motion type",
    } satisfies InspectorFieldMeta),
  mass: z
    .number()
    .finite()
    .positive()
    .default(1)
    .meta({
      label: "Mass",
      unit: "kg",
      widget: "number",
      group: "Rigid body",
      order: 20,
      description: "Mass; ignored for static bodies",
    } satisfies InspectorFieldMeta),
  friction: z
    .number()
    .finite()
    .min(0)
    .max(1)
    .default(0.5)
    .meta({
      label: "Friction",
      step: 0.01,
      widget: "slider",
      group: "Rigid body",
      order: 30,
      description: "Coulomb friction",
    } satisfies InspectorFieldMeta),
  restitution: z
    .number()
    .finite()
    .min(0)
    .max(1)
    .default(0)
    .meta({
      label: "Restitution",
      step: 0.01,
      widget: "slider",
      group: "Rigid body",
      order: 40,
      description: "Bounciness",
    } satisfies InspectorFieldMeta),
});

export type RigidBody = z.infer<typeof RigidBodySchema>;
