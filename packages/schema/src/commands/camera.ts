import { z } from "zod";
import type { CommandSchema } from "../command-schema.js";
import { EmptyObjectSchema, EntityRefSchema, MUTATING } from "./common.js";

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
