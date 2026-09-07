import { z } from "zod";
import { AssetBaseSchema, BlobRefSchema } from "./base.js";

export const ScriptAssetSchema = AssetBaseSchema.extend({
  kind: z.literal("script"),
  language: z.literal("ts"),
  source: z
    .string()
    .max(256 * 1024)
    .optional(),
  blob: BlobRefSchema.optional(),
  apiVersion: z.string().min(1),
});

export type ScriptAsset = z.infer<typeof ScriptAssetSchema>;
