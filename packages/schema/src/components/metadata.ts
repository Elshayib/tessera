import { z } from "zod";
import type { InspectorFieldMeta } from "../inspector-field.js";
import { JsonValueSchema } from "../primitives.js";

export const MetadataSchema = z
  .record(z.string().max(64), JsonValueSchema)
  .refine((value) => Object.keys(value).length <= 64, { message: "at most 64 metadata keys" })
  .refine((value) => JSON.stringify(value).length <= 16 * 1024, {
    message: "metadata serialized size must be <= 16 KB",
  })
  .meta({
    label: "Metadata",
    widget: "json",
    group: "Metadata",
    order: 10,
    description: "Opaque JSON exported to extras",
  } satisfies InspectorFieldMeta);

export type Metadata = z.infer<typeof MetadataSchema>;
