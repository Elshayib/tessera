import { z } from "zod";
import type { InspectorFieldMeta } from "../inspector-field.js";
import { HexColorSchema } from "../primitives.js";
import { AssetBaseSchema, BlobRefSchema } from "./base.js";

const sourceKindMeta = {
  label: "Source kind",
  widget: "select",
  group: "Environment",
  order: 10,
  description: "HDRI blob or solid color",
} as const satisfies InspectorFieldMeta;

export const EnvironmentAssetSchema = AssetBaseSchema.extend({
  kind: z.literal("environment").meta({
    label: "Kind",
    widget: "select",
    group: "Asset",
    order: 0,
    description: "Asset kind",
  } satisfies InspectorFieldMeta),
  source: z
    .discriminatedUnion("kind", [
      z.object({
        kind: z.literal("hdri").meta(sourceKindMeta),
        blob: BlobRefSchema.meta({
          label: "Blob",
          widget: "json",
          group: "Environment",
          order: 20,
          description: "HDRI blob",
        } satisfies InspectorFieldMeta),
      }),
      z.object({
        kind: z.literal("color").meta(sourceKindMeta),
        color: HexColorSchema.meta({
          label: "Color",
          widget: "color",
          group: "Environment",
          order: 20,
          description: "Solid sky color",
        } satisfies InspectorFieldMeta),
      }),
    ])
    .meta({
      label: "Source",
      widget: "select",
      group: "Environment",
      order: 10,
      description: "HDRI or color source",
    } satisfies InspectorFieldMeta),
  rotation: z
    .number()
    .finite()
    .default(0)
    .meta({
      label: "Rotation",
      unit: "°",
      widget: "number",
      group: "Environment",
      order: 30,
      description: "Yaw around Y",
    } satisfies InspectorFieldMeta),
  intensity: z
    .number()
    .finite()
    .min(0)
    .default(1)
    .meta({
      label: "Intensity",
      widget: "number",
      group: "Environment",
      order: 40,
      description: "Environment intensity",
    } satisfies InspectorFieldMeta),
});

export type EnvironmentAsset = z.infer<typeof EnvironmentAssetSchema>;
