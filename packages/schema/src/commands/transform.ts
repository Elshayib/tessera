import { z } from "zod";
import type { CommandSchema } from "../command-schema.js";
import { TransformSchema } from "../components/transform.js";
import { Vec3Schema } from "../primitives.js";
import { EntityRefSchema, MUTATING } from "./common.js";

const SpaceSchema = z.enum(["local", "world", "parent"]);

const TransformOutputSchema = z.object({ transform: TransformSchema });

export const transformSetCommand = {
  name: "transform.set",
  description: "Set an entity's local transform fields.",
  input: z.object({
    target: EntityRefSchema,
    position: Vec3Schema.optional(),
    rotation: Vec3Schema.optional(),
    scale: Vec3Schema.optional(),
  }),
  output: TransformOutputSchema,
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;

export const transformTranslateCommand = {
  name: "transform.translate",
  description: "Translate an entity by a delta vector.",
  input: z.object({
    target: EntityRefSchema,
    delta: Vec3Schema,
    space: SpaceSchema.optional(),
  }),
  output: TransformOutputSchema,
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;

export const transformRotateCommand = {
  name: "transform.rotate",
  description: "Rotate an entity by an Euler delta in degrees.",
  input: z.object({
    target: EntityRefSchema,
    delta: Vec3Schema,
    space: SpaceSchema.optional(),
  }),
  output: TransformOutputSchema,
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;

export const transformScaleCommand = {
  name: "transform.scale",
  description: "Scale an entity by a per-axis factor or a uniform number.",
  input: z.object({
    target: EntityRefSchema,
    factor: z.union([Vec3Schema, z.number().finite().positive()]),
  }),
  output: TransformOutputSchema,
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;
