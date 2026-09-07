import { z } from "zod";
import { HexColorSchema } from "../primitives.js";
import { AssetBaseSchema, BlobRefSchema } from "./base.js";

export const EnvironmentAssetSchema = AssetBaseSchema.extend({
  kind: z.literal("environment"),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("hdri"), blob: BlobRefSchema }),
    z.object({ kind: z.literal("color"), color: HexColorSchema }),
  ]),
  rotation: z.number().finite().default(0),
  intensity: z.number().finite().min(0).default(1),
});

export type EnvironmentAsset = z.infer<typeof EnvironmentAssetSchema>;
