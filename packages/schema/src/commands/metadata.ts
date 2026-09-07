import { z } from "zod";
import type { CommandSchema } from "../command-schema.js";
import { JsonValueSchema } from "../primitives.js";
import { EmptyObjectSchema, EntityRefSchema, MUTATING } from "./common.js";

export const metadataSetCommand = {
  name: "metadata.set",
  description: "Merge metadata keys on an entity; null deletes a key.",
  input: z.object({
    target: EntityRefSchema,
    patch: z.record(z.string().max(64), JsonValueSchema.nullable()),
  }),
  output: EmptyObjectSchema,
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;
