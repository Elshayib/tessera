import { z } from "zod";
import { Vec3Schema } from "../primitives.js";

export const TransformSchema = z.object({
  position: Vec3Schema.default([0, 0, 0]),
  rotation: Vec3Schema.default([0, 0, 0]),
  scale: z
    .tuple([
      z.number().finite().positive(),
      z.number().finite().positive(),
      z.number().finite().positive(),
    ])
    .default([1, 1, 1]),
});

export type Transform = z.infer<typeof TransformSchema>;
