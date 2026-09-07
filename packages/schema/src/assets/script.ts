import { z } from "zod";
import type { InspectorFieldMeta } from "../inspector-field.js";
import { AssetBaseSchema, BlobRefSchema } from "./base.js";

export const ScriptAssetSchema = AssetBaseSchema.extend({
  kind: z.literal("script").meta({
    label: "Kind",
    widget: "select",
    group: "Asset",
    order: 0,
    description: "Asset kind",
  } satisfies InspectorFieldMeta),
  language: z.literal("ts").meta({
    label: "Language",
    widget: "select",
    group: "Script",
    order: 10,
    description: "Script language",
  } satisfies InspectorFieldMeta),
  source: z
    .string()
    .max(256 * 1024)
    .optional()
    .meta({
      label: "Source",
      widget: "textarea",
      group: "Script",
      order: 20,
      description: "Inline TypeScript source",
    } satisfies InspectorFieldMeta),
  blob: BlobRefSchema.optional().meta({
    label: "Blob",
    widget: "json",
    group: "Script",
    order: 30,
    description: "Script blob when not inline",
  } satisfies InspectorFieldMeta),
  apiVersion: z
    .string()
    .min(1)
    .meta({
      label: "API version",
      widget: "text",
      group: "Script",
      order: 40,
      description: "Behavior API version",
    } satisfies InspectorFieldMeta),
});

export type ScriptAsset = z.infer<typeof ScriptAssetSchema>;
