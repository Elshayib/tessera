import { z } from "zod";
import { BlobRefSchema } from "../assets/base.js";
import { EnvironmentAssetSchema } from "../assets/environment.js";
import { GeometryAssetSchema } from "../assets/geometry.js";
import { MaterialAssetSchema } from "../assets/material.js";
import { ScriptAssetSchema } from "../assets/script.js";
import { TextureAssetSchema } from "../assets/texture.js";
import type { CommandSchema } from "../command-schema.js";
import { AssetIdSchema } from "../ids.js";
import { JsonObjectSchema } from "../primitives.js";
import { EmptyObjectSchema, MUTATING, MUTATING_JOB } from "./common.js";

const GeometryInputSchema = GeometryAssetSchema.omit({ id: true, createdAt: true });
const MaterialInputSchema = MaterialAssetSchema.omit({ id: true, createdAt: true });
const TextureInputSchema = TextureAssetSchema.omit({ id: true, createdAt: true });
const EnvironmentInputSchema = EnvironmentAssetSchema.omit({ id: true, createdAt: true });
const ScriptInputSchema = ScriptAssetSchema.omit({ id: true, createdAt: true });

const AssetInputSchema = z.discriminatedUnion("kind", [
  GeometryInputSchema,
  MaterialInputSchema,
  TextureInputSchema,
  EnvironmentInputSchema,
  ScriptInputSchema,
]);

const AssetPatchSchema = z.union([
  GeometryAssetSchema.omit({ id: true, kind: true, createdAt: true }).partial(),
  MaterialAssetSchema.omit({ id: true, kind: true, createdAt: true }).partial(),
  TextureAssetSchema.omit({ id: true, kind: true, createdAt: true }).partial(),
  EnvironmentAssetSchema.omit({ id: true, kind: true, createdAt: true }).partial(),
  ScriptAssetSchema.omit({ id: true, kind: true, createdAt: true }).partial(),
]);

const ImportBlobSchema = z.union([
  BlobRefSchema,
  z.object({
    fileName: z.string().min(1),
    bytesRef: z.string().min(1),
  }),
]);

export const assetCreateCommand = {
  name: "asset.create",
  description: "Create an asset from a full asset payload minus id and createdAt.",
  input: z.object({ asset: AssetInputSchema }),
  output: z.object({ id: AssetIdSchema }),
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;

export const assetUpdateCommand = {
  name: "asset.update",
  description: "Patch an asset without changing its kind.",
  input: z.object({
    target: AssetIdSchema,
    patch: AssetPatchSchema,
  }),
  output: EmptyObjectSchema,
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;

export const assetDeleteCommand = {
  name: "asset.delete",
  description: "Delete an asset; force clears remaining references.",
  input: z.object({
    target: AssetIdSchema,
    force: z.boolean().optional(),
  }),
  output: EmptyObjectSchema,
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;

export const assetImportCommand = {
  name: "asset.import",
  description: "Start an import job that will create assets when it completes.",
  input: z.object({
    blob: ImportBlobSchema,
    options: JsonObjectSchema.optional(),
  }),
  output: z.object({ jobId: z.string().regex(/^j_[0-9a-z]{10}$/) }),
  tier: 3,
  tags: MUTATING_JOB,
} as const satisfies CommandSchema;
