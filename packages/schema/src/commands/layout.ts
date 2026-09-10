import { z } from "zod";
import type { CommandSchema } from "../command-schema.js";
import { EntityIdSchema } from "../ids.js";
import { Vec2Schema, Vec3Schema } from "../primitives.js";
import { EmptyObjectSchema, EntityRefSchema, MUTATING_MACRO } from "./common.js";

const TargetsSchema = z.array(EntityRefSchema).min(1);
const AxisSchema = z.enum(["x", "y", "z"]);
const GroundSchema = z.union([EntityRefSchema, z.literal("y0")]);

export const layoutPlaceOnCommand = {
  name: "layout.placeOn",
  description: "Rest an entity on the top of a surface's bounds without changing rotation.",
  input: z.object({
    target: EntityRefSchema,
    surface: EntityRefSchema,
    anchor: z.union([z.enum(["center", "random"]), Vec2Schema]).optional(),
    margin: z.number().finite().optional(),
    align: z.enum(["bottom"]).optional(),
  }),
  output: EmptyObjectSchema,
  tier: 2,
  tags: MUTATING_MACRO,
} as const satisfies CommandSchema;

export const layoutSnapToGroundCommand = {
  name: "layout.snapToGround",
  description: "Move entities along Y until their bottoms touch a ground plane or entity top.",
  input: z.object({
    targets: TargetsSchema,
    ground: GroundSchema.optional(),
  }),
  output: EmptyObjectSchema,
  tier: 2,
  tags: MUTATING_MACRO,
} as const satisfies CommandSchema;

export const layoutAlignToCommand = {
  name: "layout.alignTo",
  description: "Align target bounds to a reference on the chosen axes.",
  input: z.object({
    targets: TargetsSchema,
    reference: EntityRefSchema,
    axes: z.array(AxisSchema).min(1),
    mode: z.enum(["min", "center", "max"]),
  }),
  output: EmptyObjectSchema,
  tier: 2,
  tags: MUTATING_MACRO,
} as const satisfies CommandSchema;

export const layoutDistributeCommand = {
  name: "layout.distribute",
  description: "Distribute entities along an axis with even spacing or a fixed gap.",
  input: z.object({
    targets: TargetsSchema,
    axis: AxisSchema,
    spacing: z.union([z.number().finite(), z.literal("even")]).optional(),
    from: Vec3Schema.optional(),
    to: Vec3Schema.optional(),
  }),
  output: EmptyObjectSchema,
  tier: 2,
  tags: MUTATING_MACRO,
} as const satisfies CommandSchema;

export const layoutArrangeGridCommand = {
  name: "layout.arrangeGrid",
  description: "Place entities on a grid in input order.",
  input: z.object({
    targets: TargetsSchema,
    columns: z.number().int().positive(),
    spacing: Vec2Schema,
    origin: Vec3Schema.optional(),
    plane: z.enum(["xz", "xy"]).optional(),
  }),
  output: EmptyObjectSchema,
  tier: 2,
  tags: MUTATING_MACRO,
} as const satisfies CommandSchema;

export const layoutScatterCommand = {
  name: "layout.scatter",
  description: "Scatter duplicates of a template on a surface with a deterministic Poisson disk.",
  input: z.object({
    template: EntityRefSchema,
    surface: EntityRefSchema,
    count: z.number().int().min(1).max(500),
    seed: z.number().finite(),
    minDistance: z.number().finite().nonnegative().optional(),
    alignToNormal: z.boolean().optional(),
    randomYaw: z.boolean().optional(),
    scaleJitter: z.number().finite().nonnegative().optional(),
  }),
  output: z.object({ ids: z.array(EntityIdSchema) }),
  tier: 2,
  tags: MUTATING_MACRO,
} as const satisfies CommandSchema;

export const layoutLookAtCommand = {
  name: "layout.lookAt",
  description: "Rotate an entity so local −Z faces a point or entity.",
  input: z.object({
    target: EntityRefSchema,
    point: z.union([Vec3Schema, EntityRefSchema]),
    up: Vec3Schema.optional(),
  }),
  output: EmptyObjectSchema,
  tier: 2,
  tags: MUTATING_MACRO,
} as const satisfies CommandSchema;

export const layoutResolveOverlapsCommand = {
  name: "layout.resolveOverlaps",
  description: "Push overlapping bounds apart on XZ by a minimal translation.",
  input: z.object({
    targets: TargetsSchema,
    iterations: z.number().int().positive().optional(),
    ground: GroundSchema.optional(),
  }),
  output: EmptyObjectSchema,
  tier: 2,
  tags: MUTATING_MACRO,
} as const satisfies CommandSchema;
