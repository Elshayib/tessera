import { z } from "zod";
import { AssetIdSchema } from "../ids.js";

export const MeshRendererSchema = z.object({
  geometry: AssetIdSchema,
  materials: z.array(AssetIdSchema).max(64).default([]),
  castShadow: z.boolean().default(true),
  receiveShadow: z.boolean().default(true),
  visible: z.boolean().default(true),
});

export type MeshRenderer = z.infer<typeof MeshRendererSchema>;
