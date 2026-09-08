import { z } from "zod";
import type { QuerySchema } from "../command-schema.js";
import { EntityRefSchema } from "../commands/common.js";
import { EntitySchema } from "../entity.js";
import { EntityIdSchema } from "../ids.js";

export const entityGetQuery = {
  name: "entity.get",
  description: "Read an entity, optionally including ordered child ids.",
  input: z.object({
    target: EntityRefSchema,
    includeChildren: z.boolean().optional(),
  }),
  output: z.object({
    entity: EntitySchema,
    children: z.array(EntityIdSchema).optional(),
  }),
  tags: [],
} as const satisfies QuerySchema;

export const entityChildrenQuery = {
  name: "entity.children",
  description: "List ordered child entity ids of a parent, or root entities when target is null.",
  input: z.object({
    target: EntityRefSchema.nullable(),
  }),
  output: z.array(EntityIdSchema),
  tags: [],
} as const satisfies QuerySchema;
