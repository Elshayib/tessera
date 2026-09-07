import { z } from "zod";
import type { CommandSchema } from "../command-schema.js";
import { EnvironmentSchema } from "../environment.js";
import { EmptyObjectSchema, MUTATING } from "./common.js";

export const environmentSetCommand = {
  name: "environment.set",
  description: "Patch document-level environment fields.",
  input: z.object({
    patch: EnvironmentSchema.partial(),
  }),
  output: EmptyObjectSchema,
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;
