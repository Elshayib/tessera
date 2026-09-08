import { z } from "zod";
import { EnvironmentAssetSchema } from "./environment.js";
import { GeometryAssetSchema } from "./geometry.js";
import { MaterialAssetSchema } from "./material.js";
import { ScriptAssetSchema } from "./script.js";
import { TextureAssetSchema } from "./texture.js";

export const AssetSchema = z.discriminatedUnion("kind", [
  GeometryAssetSchema,
  MaterialAssetSchema,
  TextureAssetSchema,
  EnvironmentAssetSchema,
  ScriptAssetSchema,
]);

export type Asset = z.infer<typeof AssetSchema>;
