import { z } from "zod";
import { MaterialAssetSchema } from "../assets/material.js";
import type { CommandSchema } from "../command-schema.js";
import { AssetIdSchema } from "../ids.js";
import { NameSchema } from "../primitives.js";
import { EmptyObjectSchema, EntityRefSchema, MUTATING } from "./common.js";

const MaterialFieldsSchema = MaterialAssetSchema.omit({
  id: true,
  kind: true,
  createdAt: true,
  name: true,
  license: true,
  provenance: true,
  tags: true,
}).partial();

export const materialCreateCommand = {
  name: "material.create",
  description: "Create a material asset, defaulting provenance source to derived.",
  input: z.object({
    name: NameSchema.optional(),
    material: MaterialFieldsSchema.optional(),
    license: z.string().min(1).optional(),
    provenance: z
      .object({
        source: z.string().min(1).optional(),
        sourceId: z.string().optional(),
        sourceUrl: z.string().optional(),
        author: z.string().optional(),
      })
      .optional(),
  }),
  output: z.object({ id: AssetIdSchema }),
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;

export const materialSetCommand = {
  name: "material.set",
  description: "Patch fields of a material asset.",
  input: z.object({
    target: AssetIdSchema,
    patch: MaterialFieldsSchema,
  }),
  output: EmptyObjectSchema,
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;

export const materialAssignCommand = {
  name: "material.assign",
  description: "Assign a material to a meshRenderer slot, or to every slot.",
  input: z.object({
    target: EntityRefSchema,
    material: AssetIdSchema,
    slot: z.number().int().nonnegative().optional(),
  }),
  output: z.object({ materials: z.array(AssetIdSchema).max(64) }),
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;
