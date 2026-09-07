import { z } from "zod";
import { Vec3Schema } from "../primitives.js";

export const ColliderSchema = z.object({
  shape: z.enum(["box", "sphere", "capsule", "convex", "mesh"]).default("box"),
  fit: z.enum(["auto", "manual"]).default("auto"),
  size: Vec3Schema.default([1, 1, 1]),
  radius: z.number().finite().positive().default(0.5),
  height: z.number().finite().positive().default(1),
  offset: Vec3Schema.default([0, 0, 0]),
  isTrigger: z.boolean().default(false),
});

export type Collider = z.infer<typeof ColliderSchema>;
