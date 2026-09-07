import { z } from "zod";

export const RigidBodySchema = z.object({
  type: z.enum(["static", "dynamic", "kinematic"]).default("static"),
  mass: z.number().finite().positive().default(1),
  friction: z.number().finite().min(0).max(1).default(0.5),
  restitution: z.number().finite().min(0).max(1).default(0),
});

export type RigidBody = z.infer<typeof RigidBodySchema>;
