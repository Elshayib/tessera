import { z } from "zod";
import { AssetIdSchema } from "../ids.js";
import { JsonObjectSchema, Vec2Schema, Vec3Schema } from "../primitives.js";
import { AssetBaseSchema, BlobRefSchema } from "./base.js";

const BoxPrimitiveSchema = z.object({
  type: z.literal("box"),
  size: Vec3Schema.default([1, 1, 1]),
});

const SpherePrimitiveSchema = z.object({
  type: z.literal("sphere"),
  radius: z.number().finite().positive().default(0.5),
  segments: z.number().int().positive().default(32),
});

const CylinderPrimitiveSchema = z.object({
  type: z.literal("cylinder"),
  radiusTop: z.number().finite().nonnegative().default(0.5),
  radiusBottom: z.number().finite().nonnegative().default(0.5),
  height: z.number().finite().positive().default(1),
  segments: z.number().int().positive().default(32),
});

const ConePrimitiveSchema = z.object({
  type: z.literal("cone"),
  radius: z.number().finite().positive().default(0.5),
  height: z.number().finite().positive().default(1),
  segments: z.number().int().positive().default(32),
});

const PlanePrimitiveSchema = z.object({
  type: z.literal("plane"),
  size: Vec2Schema.default([1, 1]),
});

const TorusPrimitiveSchema = z.object({
  type: z.literal("torus"),
  radius: z.number().finite().positive().default(0.5),
  tube: z.number().finite().positive().default(0.2),
  radialSegments: z.number().int().positive().default(16),
  tubularSegments: z.number().int().positive().default(32),
});

const CapsulePrimitiveSchema = z.object({
  type: z.literal("capsule"),
  radius: z.number().finite().positive().default(0.5),
  height: z.number().finite().positive().default(1),
  segments: z.number().int().positive().default(16),
});

const PrimitiveSchema = z.discriminatedUnion("type", [
  BoxPrimitiveSchema,
  SpherePrimitiveSchema,
  CylinderPrimitiveSchema,
  ConePrimitiveSchema,
  PlanePrimitiveSchema,
  TorusPrimitiveSchema,
  CapsulePrimitiveSchema,
]);

export type Primitive = z.infer<typeof PrimitiveSchema>;

const GeometrySourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("primitive"), primitive: PrimitiveSchema }),
  z.object({
    kind: z.literal("blob"),
    blob: BlobRefSchema,
    meshName: z.string().optional(),
    meshIndex: z.number().int().nonnegative().optional(),
  }),
  z.object({
    kind: z.literal("procedural"),
    script: AssetIdSchema,
    params: JsonObjectSchema,
  }),
]);

export const GeometryAssetSchema = AssetBaseSchema.extend({
  kind: z.literal("geometry"),
  source: GeometrySourceSchema,
  bounds: z.object({ min: Vec3Schema, max: Vec3Schema }),
  stats: z.object({
    triangles: z.number().int().nonnegative(),
    vertices: z.number().int().nonnegative(),
    primitiveGroups: z.number().int().nonnegative(),
  }),
});

export type GeometryAsset = z.infer<typeof GeometryAssetSchema>;
