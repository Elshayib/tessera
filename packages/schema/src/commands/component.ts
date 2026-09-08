import { z } from "zod";
import type { CommandSchema } from "../command-schema.js";
import { CameraFieldsSchema } from "../components/camera.js";
import { ColliderSchema } from "../components/collider.js";
import { MeshRendererSchema } from "../components/mesh-renderer.js";
import { MetadataSchema } from "../components/metadata.js";
import { RigidBodySchema } from "../components/rigid-body.js";
import { TagsSchema } from "../components/tags.js";
import { TransformSchema } from "../components/transform.js";
import { HexColorSchema, JsonValueSchema } from "../primitives.js";
import { ComponentTypeSchema, EmptyObjectSchema, EntityRefSchema, MUTATING } from "./common.js";

const LightPatchSchema = z
  .object({
    type: z.enum(["directional", "point", "spot", "area"]).optional(),
    color: HexColorSchema.optional(),
    intensity: z.number().finite().min(0).optional(),
    range: z.number().finite().min(0).optional(),
    angle: z.number().finite().gt(0).lt(90).optional(),
    penumbra: z.number().finite().min(0).max(1).optional(),
    size: z.tuple([z.number().finite().positive(), z.number().finite().positive()]).optional(),
    castShadow: z.boolean().optional(),
  })
  .strict();

const componentAddInputSchema = z.discriminatedUnion("type", [
  z.object({
    target: EntityRefSchema,
    type: z.literal("transform"),
    value: TransformSchema.partial().optional(),
  }),
  z.object({
    target: EntityRefSchema,
    type: z.literal("meshRenderer"),
    value: MeshRendererSchema.partial().optional(),
  }),
  z.object({
    target: EntityRefSchema,
    type: z.literal("light"),
    value: LightPatchSchema.optional(),
  }),
  z.object({
    target: EntityRefSchema,
    type: z.literal("camera"),
    value: CameraFieldsSchema.partial().optional(),
  }),
  z.object({
    target: EntityRefSchema,
    type: z.literal("collider"),
    value: ColliderSchema.partial().optional(),
  }),
  z.object({
    target: EntityRefSchema,
    type: z.literal("rigidBody"),
    value: RigidBodySchema.partial().optional(),
  }),
  z.object({
    target: EntityRefSchema,
    type: z.literal("tags"),
    value: TagsSchema.optional(),
  }),
  z.object({
    target: EntityRefSchema,
    type: z.literal("metadata"),
    value: MetadataSchema.optional(),
  }),
]);

const componentSetInputSchema = z.discriminatedUnion("type", [
  z.object({
    target: EntityRefSchema,
    type: z.literal("transform"),
    patch: TransformSchema.partial(),
  }),
  z.object({
    target: EntityRefSchema,
    type: z.literal("meshRenderer"),
    patch: MeshRendererSchema.partial(),
  }),
  z.object({
    target: EntityRefSchema,
    type: z.literal("light"),
    patch: LightPatchSchema,
  }),
  z.object({
    target: EntityRefSchema,
    type: z.literal("camera"),
    patch: CameraFieldsSchema.partial(),
  }),
  z.object({
    target: EntityRefSchema,
    type: z.literal("collider"),
    patch: ColliderSchema.partial(),
  }),
  z.object({
    target: EntityRefSchema,
    type: z.literal("rigidBody"),
    patch: RigidBodySchema.partial(),
  }),
  z.object({
    target: EntityRefSchema,
    type: z.literal("tags"),
    patch: TagsSchema,
  }),
  z.object({
    target: EntityRefSchema,
    type: z.literal("metadata"),
    patch: z.record(z.string().max(64), JsonValueSchema),
  }),
]);

export const componentAddCommand = {
  name: "component.add",
  description: "Add a component to an entity if it is not already present.",
  input: componentAddInputSchema,
  output: EmptyObjectSchema,
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;

export const componentRemoveCommand = {
  name: "component.remove",
  description: "Remove a component from an entity; transform cannot be removed.",
  input: z.object({
    target: EntityRefSchema,
    type: ComponentTypeSchema,
  }),
  output: EmptyObjectSchema,
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;

export const componentSetCommand = {
  name: "component.set",
  description: "Patch a component on an entity.",
  input: componentSetInputSchema,
  output: EmptyObjectSchema,
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;
