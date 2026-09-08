import { z } from "zod";
import { AssetSchema } from "./assets/index.js";
import { EntitySchema } from "./entity.js";
import { EnvironmentSchema } from "./environment.js";
import { AssetIdSchema, BehaviorIdSchema, EntityIdSchema, ProjectIdSchema } from "./ids.js";
import { IsoUtcSchema, JsonObjectSchema, NameSchema } from "./primitives.js";

export const DOCUMENT_VERSION = "0.1.0" as const;

const DocumentMetaSchema = z.object({
  id: ProjectIdSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  createdAt: IsoUtcSchema,
  updatedAt: IsoUtcSchema,
  generator: z.string().min(1),
});

export type DocumentMeta = z.infer<typeof DocumentMetaSchema>;

const SettingsSchema = z.object({
  units: z.literal("m"),
  up: z.literal("Y"),
  handedness: z.literal("right"),
  mainCamera: EntityIdSchema.nullable(),
  physics: z.object({
    gravity: z
      .tuple([z.number().finite(), z.number().finite(), z.number().finite()])
      .default([0, -9.81, 0]),
  }),
});

export type Settings = z.infer<typeof SettingsSchema>;

const BehaviorSchema = z.object({
  id: BehaviorIdSchema,
  name: NameSchema,
  target: EntityIdSchema,
  script: AssetIdSchema,
  params: JsonObjectSchema,
  enabled: z.boolean(),
});

export type Behavior = z.infer<typeof BehaviorSchema>;

export const DocumentSchema = z.object({
  version: z.literal(DOCUMENT_VERSION),
  meta: DocumentMetaSchema,
  settings: SettingsSchema,
  entities: z.record(EntityIdSchema, EntitySchema),
  assets: z.record(AssetIdSchema, AssetSchema),
  environment: EnvironmentSchema,
  behaviors: z.record(BehaviorIdSchema, BehaviorSchema),
});

export type Document = z.infer<typeof DocumentSchema>;
