import { z } from "zod";
import type { QuerySchema } from "../command-schema.js";
import { ComponentTypeSchema, EntityRefSchema } from "../commands/common.js";
import { EntityIdSchema } from "../ids.js";
import { Vec3Schema } from "../primitives.js";

export const sceneDescribeQuery = {
  name: "scene.describe",
  description: "Serialize a compact hierarchical scene description for language models.",
  input: z.object({
    root: EntityRefSchema.optional(),
    detail: z.enum(["summary", "outline", "full"]).optional(),
    maxDepth: z.number().int().positive().optional(),
    maxChars: z.number().int().positive().optional(),
    includeAssets: z.boolean().optional(),
  }),
  output: z.object({
    text: z.string(),
    truncated: z.boolean(),
    entityCount: z.number().int().nonnegative(),
  }),
  tags: ["expensive"],
} as const satisfies QuerySchema;

export const sceneFindQuery = {
  name: "scene.find",
  description: "Find entities by name glob, tag, or component type.",
  input: z.object({
    name: z.string().min(1).optional(),
    tag: z.string().min(1).optional(),
    component: ComponentTypeSchema.optional(),
    within: EntityRefSchema.optional(),
    limit: z.number().int().positive().optional(),
  }),
  output: z.object({
    matches: z.array(z.object({ id: EntityIdSchema, path: z.string().min(1) })),
  }),
  tags: [],
} as const satisfies QuerySchema;

export const sceneStatsQuery = {
  name: "scene.stats",
  description: "Return entity and asset counts, triangle totals, and combined bounds.",
  input: z.object({}),
  output: z.object({
    entityCount: z.number().int().nonnegative(),
    assetCount: z.number().int().nonnegative(),
    behaviorCount: z.number().int().nonnegative(),
    triangles: z.number().int().nonnegative(),
    vertices: z.number().int().nonnegative(),
    bounds: z.object({ min: Vec3Schema, max: Vec3Schema }).nullable(),
  }),
  tags: [],
} as const satisfies QuerySchema;

export const sceneMeasureQuery = {
  name: "scene.measure",
  description: "Measure distance, bounds, or gap between entities.",
  input: z.object({
    a: EntityRefSchema,
    b: EntityRefSchema.optional(),
    mode: z.enum(["distance", "bounds", "gap"]),
  }),
  output: z.object({
    value: z.number().finite(),
  }),
  tags: [],
} as const satisfies QuerySchema;
