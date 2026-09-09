import { z } from "zod";
import type { CommandSchema } from "../command-schema.js";
import { EmptyObjectSchema, EntityRefSchema, MUTATING, MUTATING_MACRO } from "./common.js";

export const cameraSetMainCommand = {
  name: "camera.setMain",
  description: "Set the document main camera to an entity that has a camera component.",
  input: z.object({
    target: EntityRefSchema,
  }),
  output: EmptyObjectSchema,
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;

export const cameraFitCommand = {
  name: "camera.fit",
  description: "Position a camera entity to frame target bounds.",
  input: z.object({
    camera: EntityRefSchema,
    targets: z.union([z.array(EntityRefSchema).min(1), z.literal("all")]),
    padding: z.number().finite().optional(),
    direction: z.enum(["keep", "front", "iso", "top"]).optional(),
  }),
  output: EmptyObjectSchema,
  tier: 2,
  tags: MUTATING_MACRO,
} as const satisfies CommandSchema;
