import { z } from "zod";
import { CameraSchema } from "./components/camera.js";
import { LightSchema } from "./components/light.js";
import { RigidBodySchema } from "./components/rigid-body.js";
import { DOCUMENT_VERSION } from "./document.js";
import { AssetIdSchema, BehaviorIdSchema, EntityIdSchema } from "./ids.js";
import {
  HexColorSchema,
  IsoUtcSchema,
  JsonObjectSchema,
  NameSchema,
  Vec3Schema,
} from "./primitives.js";

const TO_JSON_SCHEMA = {
  io: "output",
  reused: "inline",
  unrepresentable: "any",
} as const;

/**
 * Sidecar format id (`09` §4).
 *
 * @public
 */
export const SIDECAR_FORMAT = "tessera-sidecar" as const;

/**
 * Sidecar schema version (`09` §4).
 *
 * @public
 */
export const SIDECAR_VERSION = 1 as const;

const SidecarSkySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("environment"),
    file: z.string().min(1),
    rotation: z.number().finite(),
    intensity: z.number().finite(),
  }),
  z.object({ kind: z.literal("color"), color: HexColorSchema }),
  z.object({ kind: z.literal("none") }),
]);

const SidecarFogSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({
    kind: z.literal("linear"),
    color: HexColorSchema,
    near: z.number().finite(),
    far: z.number().finite(),
  }),
  z.object({
    kind: z.literal("exponential"),
    color: HexColorSchema,
    density: z.number().finite().min(0),
  }),
]);

const SidecarEnvironmentSchema = z.object({
  sky: SidecarSkySchema,
  exposure: z.number().finite(),
  toneMapping: z.enum(["neutral", "aces", "agx", "none"]),
  fog: SidecarFogSchema,
  ambient: z.object({
    color: HexColorSchema,
    intensity: z.number().finite().min(0),
  }),
});

const SidecarColliderSchema = z.object({
  shape: z.enum(["box", "sphere", "capsule", "convex", "mesh"]),
  size: Vec3Schema.optional(),
  radius: z.number().finite().positive().optional(),
  height: z.number().finite().positive().optional(),
  offset: Vec3Schema,
  isTrigger: z.boolean(),
});

const SidecarBehaviorSchema = z.object({
  id: BehaviorIdSchema,
  name: NameSchema,
  params: JsonObjectSchema,
});

const SidecarProvenanceSchema = z.object({
  source: z.string().min(1),
  sourceId: z.string().optional(),
  sourceUrl: z.string().optional(),
  author: z.string().optional(),
  importedAt: IsoUtcSchema,
});

const SidecarEntitySchema = z.object({
  id: EntityIdSchema,
  name: NameSchema,
  path: z.string().min(1),
  nodeIndex: z.number().int().nonnegative(),
  enabled: z.boolean(),
  visible: z.boolean(),
  tags: z.array(z.string()),
  collider: SidecarColliderSchema.nullable(),
  rigidBody: RigidBodySchema.nullable(),
  metadata: JsonObjectSchema,
  behaviors: z.array(SidecarBehaviorSchema),
  light: LightSchema.nullable(),
  camera: CameraSchema.nullable(),
});

const SidecarAssetSchema = z.object({
  id: AssetIdSchema,
  kind: z.enum(["geometry", "material", "texture", "environment", "script"]),
  name: NameSchema,
  license: z.string().min(1),
  provenance: SidecarProvenanceSchema,
});

/**
 * Zod schema for `<name>.tessera.json` (`09` §4).
 *
 * @public
 */
export const SidecarSchema = z.object({
  format: z.literal(SIDECAR_FORMAT),
  version: z.literal(SIDECAR_VERSION),
  documentVersion: z.literal(DOCUMENT_VERSION),
  generator: z.string().min(1),
  exportedAt: IsoUtcSchema.optional(),
  settings: z.object({
    units: z.literal("m"),
    up: z.literal("Y"),
    handedness: z.literal("right"),
    mainCamera: EntityIdSchema.nullable(),
  }),
  environment: SidecarEnvironmentSchema,
  entities: z.array(SidecarEntitySchema),
  assets: z.array(SidecarAssetSchema),
  attribution: z.string().optional(),
});

export type Sidecar = z.infer<typeof SidecarSchema>;
export type SidecarEntity = z.infer<typeof SidecarEntitySchema>;
export type SidecarAsset = z.infer<typeof SidecarAssetSchema>;
export type SidecarEnvironment = z.infer<typeof SidecarEnvironmentSchema>;
export type SidecarCollider = z.infer<typeof SidecarColliderSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (!isRecord(value)) {
    return value;
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortValue(value[key]);
  }
  return sorted;
}

/**
 * JSON Schema for {@link SidecarSchema}, deterministic key order (`09` §4).
 *
 * @example
 * ```ts
 * const schema = emitSidecarJsonSchema();
 * ```
 *
 * @public
 */
export function emitSidecarJsonSchema(): unknown {
  return sortValue(z.toJSONSchema(SidecarSchema, TO_JSON_SCHEMA));
}

/**
 * Pretty-print {@link emitSidecarJsonSchema} with a trailing newline.
 *
 * @public
 */
export function emitSidecarJsonSchemaText(): string {
  return `${JSON.stringify(emitSidecarJsonSchema(), null, 2)}\n`;
}
