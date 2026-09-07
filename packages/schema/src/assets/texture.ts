import { z } from "zod";
import { Vec2Schema } from "../primitives.js";
import { AssetBaseSchema, BlobRefSchema } from "./base.js";

export const TextureAssetSchema = AssetBaseSchema.extend({
  kind: z.literal("texture"),
  blob: BlobRefSchema,
  colorSpace: z.enum(["srgb", "linear"]),
  wrapS: z.enum(["repeat", "clamp", "mirror"]).default("repeat"),
  wrapT: z.enum(["repeat", "clamp", "mirror"]).default("repeat"),
  size: Vec2Schema,
  hasAlpha: z.boolean(),
});

export type TextureAsset = z.infer<typeof TextureAssetSchema>;
