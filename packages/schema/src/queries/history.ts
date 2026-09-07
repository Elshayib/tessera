import { z } from "zod";
import { AssetSchema } from "../assets/index.js";
import type { QuerySchema } from "../command-schema.js";
import { EntitySchema } from "../entity.js";
import { AssetIdSchema, BehaviorIdSchema, EntityIdSchema } from "../ids.js";
import { IsoUtcSchema } from "../primitives.js";

const AuthorSchema = z.object({
  kind: z.enum(["user", "agent", "remote", "system"]),
  id: z.string().min(1),
  runId: z.string().min(1).optional(),
});

const FieldChangeSchema = z.object({
  path: z.string().min(1),
  before: z.unknown(),
  after: z.unknown(),
});

const ChangeSetSchema = z.object({
  entities: z.object({
    created: z.array(EntityIdSchema),
    deleted: z.array(EntitySchema),
    updated: z.array(
      z.object({
        id: EntityIdSchema,
        fields: z.array(FieldChangeSchema),
      }),
    ),
  }),
  assets: z.object({
    created: z.array(AssetIdSchema),
    deleted: z.array(AssetSchema),
    updated: z.array(
      z.object({
        id: AssetIdSchema,
        fields: z.array(FieldChangeSchema),
      }),
    ),
  }),
  environment: z.array(FieldChangeSchema).optional(),
  settings: z.array(FieldChangeSchema).optional(),
  behaviors: z.object({
    created: z.array(BehaviorIdSchema),
    deleted: z.array(BehaviorIdSchema),
    updated: z.array(BehaviorIdSchema),
  }),
  summary: z.string().max(200),
});

const TransactionRecordSchema = z.object({
  id: z.string().regex(/^t_[0-9a-z]{10}$/),
  author: AuthorSchema,
  label: z.string().min(1),
  runId: z.string().min(1).optional(),
  startedAt: IsoUtcSchema,
  durationMs: z.number().finite().nonnegative(),
  commands: z.array(
    z.object({
      name: z.string().min(1),
      input: z.unknown(),
    }),
  ),
  changeSet: ChangeSetSchema,
});

export const historyListQuery = {
  name: "history.list",
  description: "List committed transactions for the undo timeline.",
  input: z.object({
    limit: z.number().int().positive().optional(),
    runId: z.string().min(1).optional(),
  }),
  output: z.array(TransactionRecordSchema),
  tags: [],
} as const satisfies QuerySchema;
