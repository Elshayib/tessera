import { z } from "zod";
import type { InspectorFieldMeta } from "../inspector-field.js";
import { Vec2Schema } from "../primitives.js";
import { AssetBaseSchema, BlobRefSchema } from "./base.js";

export const TextureAssetSchema = AssetBaseSchema.extend({
  kind: z.literal("texture").meta({
    label: "Kind",
    widget: "select",
    group: "Asset",
    order: 0,
    description: "Asset kind",
  } satisfies InspectorFieldMeta),
  blob: BlobRefSchema.meta({
    label: "Blob",
    widget: "json",
    group: "Texture",
    order: 10,
    description: "Image blob",
  } satisfies InspectorFieldMeta),
  colorSpace: z.enum(["srgb", "linear"]).meta({
    label: "Color space",
    widget: "select",
    group: "Texture",
    order: 20,
    description: "Sampling color space",
  } satisfies InspectorFieldMeta),
  wrapS: z
    .enum(["repeat", "clamp", "mirror"])
    .default("repeat")
    .meta({
      label: "Wrap S",
      widget: "select",
      group: "Texture",
      order: 30,
      description: "Horizontal wrap",
    } satisfies InspectorFieldMeta),
  wrapT: z
    .enum(["repeat", "clamp", "mirror"])
    .default("repeat")
    .meta({
      label: "Wrap T",
      widget: "select",
      group: "Texture",
      order: 40,
      description: "Vertical wrap",
    } satisfies InspectorFieldMeta),
  size: Vec2Schema.meta({
    label: "Size",
    widget: "vec2",
    group: "Texture",
    order: 50,
    description: "Pixel width and height",
  } satisfies InspectorFieldMeta),
  hasAlpha: z.boolean().meta({
    label: "Has alpha",
    widget: "toggle",
    group: "Texture",
    order: 60,
    description: "Whether the image has an alpha channel",
  } satisfies InspectorFieldMeta),
});

export type TextureAsset = z.infer<typeof TextureAssetSchema>;
