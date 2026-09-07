import { z } from "zod";
import { TagSchema } from "../primitives.js";

export const TagsSchema = z
  .array(TagSchema)
  .max(32)
  .refine((tags) => new Set(tags).size === tags.length, { message: "tags must be unique" });

export type Tags = z.infer<typeof TagsSchema>;
