import { z } from "zod";
import { AssetIdSchema } from "../ids.js";
import type { InspectorFieldMeta } from "../inspector-field.js";
import { HexColorSchema, Vec2Schema } from "../primitives.js";
import { AssetBaseSchema } from "./base.js";

const TextureSlotSchema = z.object({
  texture: AssetIdSchema.meta({
    label: "Texture",
    widget: "asset",
    assetKind: "texture",
    group: "Texture slot",
    order: 10,
    description: "Texture asset",
  } satisfies InspectorFieldMeta),
  texCoord: z.union([z.literal(0), z.literal(1)]).meta({
    label: "UV set",
    widget: "select",
    group: "Texture slot",
    order: 20,
    description: "Texture coordinate set",
  } satisfies InspectorFieldMeta),
  scale: Vec2Schema.optional().meta({
    label: "Scale",
    widget: "vec2",
    group: "Texture slot",
    order: 30,
    description: "KHR_texture_transform scale",
  } satisfies InspectorFieldMeta),
  offset: Vec2Schema.optional().meta({
    label: "Offset",
    widget: "vec2",
    group: "Texture slot",
    order: 40,
    description: "KHR_texture_transform offset",
  } satisfies InspectorFieldMeta),
  rotation: z
    .number()
    .finite()
    .optional()
    .meta({
      label: "Rotation",
      unit: "°",
      widget: "number",
      group: "Texture slot",
      order: 50,
      description: "KHR_texture_transform rotation",
    } satisfies InspectorFieldMeta),
});

export type TextureSlot = z.infer<typeof TextureSlotSchema>;

const slotMeta = (label: string, order: number): InspectorFieldMeta => ({
  label,
  widget: "asset",
  assetKind: "texture",
  group: "Material",
  order,
  description: `${label} texture slot`,
});

export const MaterialAssetSchema = AssetBaseSchema.extend({
  kind: z.literal("material").meta({
    label: "Kind",
    widget: "select",
    group: "Asset",
    order: 0,
    description: "Asset kind",
  } satisfies InspectorFieldMeta),
  model: z
    .enum(["pbr", "unlit"])
    .default("pbr")
    .meta({
      label: "Model",
      widget: "select",
      group: "Material",
      order: 10,
      description: "Shading model",
    } satisfies InspectorFieldMeta),
  baseColor: HexColorSchema.default("#cccccc").meta({
    label: "Base color",
    widget: "color",
    group: "Material",
    order: 20,
    description: "Base color factor",
  } satisfies InspectorFieldMeta),
  baseColorTexture: TextureSlotSchema.optional().meta(slotMeta("Base color", 21)),
  metallic: z
    .number()
    .finite()
    .min(0)
    .max(1)
    .default(0)
    .meta({
      label: "Metallic",
      step: 0.01,
      widget: "slider",
      group: "Material",
      order: 30,
      description: "Metallic factor",
    } satisfies InspectorFieldMeta),
  roughness: z
    .number()
    .finite()
    .min(0)
    .max(1)
    .default(0.6)
    .meta({
      label: "Roughness",
      step: 0.01,
      widget: "slider",
      group: "Material",
      order: 40,
      description: "Roughness factor",
    } satisfies InspectorFieldMeta),
  metallicRoughnessTexture: TextureSlotSchema.optional().meta(slotMeta("Metallic-roughness", 41)),
  normalTexture: TextureSlotSchema.optional().meta(slotMeta("Normal", 50)),
  normalScale: z
    .number()
    .finite()
    .default(1)
    .meta({
      label: "Normal scale",
      widget: "number",
      group: "Material",
      order: 51,
      description: "Normal map scale",
    } satisfies InspectorFieldMeta),
  occlusionTexture: TextureSlotSchema.optional().meta(slotMeta("Occlusion", 60)),
  occlusionStrength: z
    .number()
    .finite()
    .min(0)
    .max(1)
    .default(1)
    .meta({
      label: "Occlusion strength",
      step: 0.01,
      widget: "slider",
      group: "Material",
      order: 61,
      description: "Occlusion strength",
    } satisfies InspectorFieldMeta),
  emissive: HexColorSchema.default("#000000").meta({
    label: "Emissive",
    widget: "color",
    group: "Material",
    order: 70,
    description: "Emissive factor",
  } satisfies InspectorFieldMeta),
  emissiveStrength: z
    .number()
    .finite()
    .min(0)
    .default(1)
    .meta({
      label: "Emissive strength",
      widget: "number",
      group: "Material",
      order: 71,
      description: "Emissive strength",
    } satisfies InspectorFieldMeta),
  emissiveTexture: TextureSlotSchema.optional().meta(slotMeta("Emissive", 72)),
  opacity: z
    .number()
    .finite()
    .min(0)
    .max(1)
    .default(1)
    .meta({
      label: "Opacity",
      step: 0.01,
      widget: "slider",
      group: "Material",
      order: 80,
      description: "Opacity factor",
    } satisfies InspectorFieldMeta),
  alphaMode: z
    .enum(["opaque", "mask", "blend"])
    .default("opaque")
    .meta({
      label: "Alpha mode",
      widget: "select",
      group: "Material",
      order: 81,
      description: "Alpha mode",
    } satisfies InspectorFieldMeta),
  alphaCutoff: z
    .number()
    .finite()
    .min(0)
    .max(1)
    .default(0.5)
    .meta({
      label: "Alpha cutoff",
      step: 0.01,
      widget: "slider",
      group: "Material",
      order: 82,
      description: "Mask cutoff",
    } satisfies InspectorFieldMeta),
  doubleSided: z
    .boolean()
    .default(false)
    .meta({
      label: "Double sided",
      widget: "toggle",
      group: "Material",
      order: 83,
      description: "Render both faces",
    } satisfies InspectorFieldMeta),
  transmission: z
    .number()
    .finite()
    .min(0)
    .max(1)
    .optional()
    .meta({
      label: "Transmission",
      step: 0.01,
      widget: "slider",
      group: "Advanced",
      order: 90,
      description: "KHR_materials_transmission",
    } satisfies InspectorFieldMeta),
  ior: z
    .number()
    .finite()
    .positive()
    .optional()
    .meta({
      label: "IOR",
      widget: "number",
      group: "Advanced",
      order: 91,
      description: "Index of refraction",
    } satisfies InspectorFieldMeta),
  thickness: z
    .number()
    .finite()
    .min(0)
    .optional()
    .meta({
      label: "Thickness",
      widget: "number",
      group: "Advanced",
      order: 92,
      description: "Volume thickness",
    } satisfies InspectorFieldMeta),
  clearcoat: z
    .number()
    .finite()
    .min(0)
    .max(1)
    .optional()
    .meta({
      label: "Clearcoat",
      step: 0.01,
      widget: "slider",
      group: "Advanced",
      order: 93,
      description: "Clearcoat factor",
    } satisfies InspectorFieldMeta),
  clearcoatRoughness: z
    .number()
    .finite()
    .min(0)
    .max(1)
    .optional()
    .meta({
      label: "Clearcoat roughness",
      step: 0.01,
      widget: "slider",
      group: "Advanced",
      order: 94,
      description: "Clearcoat roughness",
    } satisfies InspectorFieldMeta),
});

export type MaterialAsset = z.infer<typeof MaterialAssetSchema>;
