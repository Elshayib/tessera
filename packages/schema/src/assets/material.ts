import { z } from "zod";
import { AssetIdSchema } from "../ids.js";
import { HexColorSchema, Vec2Schema } from "../primitives.js";
import { AssetBaseSchema } from "./base.js";

const TextureSlotSchema = z.object({
  texture: AssetIdSchema,
  texCoord: z.union([z.literal(0), z.literal(1)]),
  scale: Vec2Schema.optional(),
  offset: Vec2Schema.optional(),
  rotation: z.number().finite().optional(),
});

export type TextureSlot = z.infer<typeof TextureSlotSchema>;

export const MaterialAssetSchema = AssetBaseSchema.extend({
  kind: z.literal("material"),
  model: z.enum(["pbr", "unlit"]).default("pbr"),
  baseColor: HexColorSchema.default("#cccccc"),
  baseColorTexture: TextureSlotSchema.optional(),
  metallic: z.number().finite().min(0).max(1).default(0),
  roughness: z.number().finite().min(0).max(1).default(0.6),
  metallicRoughnessTexture: TextureSlotSchema.optional(),
  normalTexture: TextureSlotSchema.optional(),
  normalScale: z.number().finite().default(1),
  occlusionTexture: TextureSlotSchema.optional(),
  occlusionStrength: z.number().finite().min(0).max(1).default(1),
  emissive: HexColorSchema.default("#000000"),
  emissiveStrength: z.number().finite().min(0).default(1),
  emissiveTexture: TextureSlotSchema.optional(),
  opacity: z.number().finite().min(0).max(1).default(1),
  alphaMode: z.enum(["opaque", "mask", "blend"]).default("opaque"),
  alphaCutoff: z.number().finite().min(0).max(1).default(0.5),
  doubleSided: z.boolean().default(false),
  transmission: z.number().finite().min(0).max(1).optional(),
  ior: z.number().finite().positive().optional(),
  thickness: z.number().finite().min(0).optional(),
  clearcoat: z.number().finite().min(0).max(1).optional(),
  clearcoatRoughness: z.number().finite().min(0).max(1).optional(),
});

export type MaterialAsset = z.infer<typeof MaterialAssetSchema>;
