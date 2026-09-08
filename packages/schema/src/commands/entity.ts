import { z } from "zod";
import type { CommandSchema } from "../command-schema.js";
import { ComponentsSchema } from "../components/index.js";
import { EntityIdSchema } from "../ids.js";
import { NameSchema, Vec3Schema } from "../primitives.js";
import { EmptyObjectSchema, EntityRefSchema, MUTATING } from "./common.js";

export const entityCreateCommand = {
  name: "entity.create",
  description: "Create an entity with optional parent, components, and sibling order.",
  input: z.object({
    name: NameSchema.optional(),
    parent: EntityRefSchema.nullable().optional(),
    components: ComponentsSchema.partial().optional(),
    after: EntityRefSchema.optional(),
    strictName: z.boolean().optional(),
  }),
  output: z.object({ id: EntityIdSchema }),
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;

export const entityDeleteCommand = {
  name: "entity.delete",
  description: "Delete an entity and its subtree.",
  input: z.object({ target: EntityRefSchema }),
  output: z.object({ deleted: z.array(EntityIdSchema) }),
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;

export const entityDuplicateCommand = {
  name: "entity.duplicate",
  description: "Deep-copy an entity subtree with new ids; assets are shared.",
  input: z.object({
    target: EntityRefSchema,
    count: z.number().int().min(1).max(100).optional(),
    offset: Vec3Schema.optional(),
    parent: EntityRefSchema.optional(),
  }),
  output: z.object({ ids: z.array(EntityIdSchema) }),
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;

export const entityRenameCommand = {
  name: "entity.rename",
  description: "Rename an entity, resolving sibling uniqueness unless strictName is set.",
  input: z.object({
    target: EntityRefSchema,
    name: NameSchema,
    strictName: z.boolean().optional(),
  }),
  output: z.object({ name: NameSchema }),
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;

export const entitySetParentCommand = {
  name: "entity.setParent",
  description: "Reparent an entity, optionally preserving world transform.",
  input: z.object({
    target: EntityRefSchema,
    parent: EntityRefSchema.nullable(),
    after: EntityRefSchema.optional(),
    keepWorldTransform: z.boolean().optional(),
  }),
  output: EmptyObjectSchema,
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;

export const entityReorderCommand = {
  name: "entity.reorder",
  description: "Reorder an entity among its current siblings.",
  input: z.object({
    target: EntityRefSchema,
    after: EntityRefSchema.nullable().optional(),
  }),
  output: z.object({ order: z.string().min(1) }),
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;

export const entitySetEnabledCommand = {
  name: "entity.setEnabled",
  description: "Enable or disable an entity.",
  input: z.object({
    target: EntityRefSchema,
    enabled: z.boolean(),
  }),
  output: EmptyObjectSchema,
  tier: 1,
  tags: MUTATING,
} as const satisfies CommandSchema;
