import { z } from "zod";
import type { CommandSchema } from "../command-schema.js";
import { TagsSchema } from "../components/tags.js";
import { TagSchema } from "../primitives.js";
import { EntityRefSchema, MUTATING } from "./common.js";

const TagsInputSchema = z.object({
  target: EntityRefSchema,
  tags: z.array(TagSchema).min(1).max(32),
});

const TagsOutputSchema = z.object({ tags: TagsSchema });

export const tagsAddCommand = {
  name: "tags.add",
  description: "Add unique tags to an entity.",
  input: TagsInputSchema,
  output: TagsOutputSchema,
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;

export const tagsRemoveCommand = {
  name: "tags.remove",
  description: "Remove tags from an entity.",
  input: TagsInputSchema,
  output: TagsOutputSchema,
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;
