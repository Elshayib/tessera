import { z } from "zod";
import type { CommandSchema } from "../command-schema.js";
import { EmptyObjectSchema, EntityRefSchema, MUTATING } from "./common.js";

export const settingsSetCommand = {
  name: "settings.set",
  description: "Patch mutable settings; units, up, and handedness are rejected.",
  input: z.object({
    patch: z
      .object({
        mainCamera: EntityRefSchema.nullable().optional(),
        physics: z
          .object({
            gravity: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
          })
          .optional(),
      })
      .strict(),
  }),
  output: EmptyObjectSchema,
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;
