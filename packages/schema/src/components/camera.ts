import { z } from "zod";

export const CameraSchema = z
  .object({
    type: z.enum(["perspective", "orthographic"]).default("perspective"),
    fov: z.number().finite().gt(1).lt(179).default(50),
    near: z.number().finite().positive().default(0.1),
    far: z.number().finite().positive().default(1000),
    orthoSize: z.number().finite().positive().default(5),
  })
  .refine((value) => value.far > value.near, { message: "far must be greater than near" });

export type Camera = z.infer<typeof CameraSchema>;
