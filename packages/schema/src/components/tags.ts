import { z } from "zod";
import type { InspectorFieldMeta } from "../inspector-field.js";
import { TagSchema } from "../primitives.js";

export const TagsSchema = z
  .array(TagSchema)
  .max(32)
  .refine((tags) => new Set(tags).size === tags.length, { message: "tags must be unique" })
  .meta({
    label: "Tags",
    widget: "tags",
    group: "Tags",
    order: 10,
    description: "Query and export tags",
  } satisfies InspectorFieldMeta);

export type Tags = z.infer<typeof TagsSchema>;
