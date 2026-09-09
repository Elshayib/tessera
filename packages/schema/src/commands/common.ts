import { z } from "zod";
import { EntityIdSchema } from "../ids.js";

/**
 * Entity id or a path from the document root (`docs/04-command-bus.md` §8).
 */
export const EntityRefSchema = z.union([EntityIdSchema, z.object({ path: z.string().min(1) })]);

export type EntityRef = z.infer<typeof EntityRefSchema>;

export const COMPONENT_TYPES = [
  "transform",
  "meshRenderer",
  "light",
  "camera",
  "collider",
  "rigidBody",
  "tags",
  "metadata",
] as const;

export const ComponentTypeSchema = z.enum(COMPONENT_TYPES);

export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const EmptyObjectSchema = z.object({});

export const MUTATING = ["mutating"] as const;

export const MUTATING_JOB = ["mutating", "job"] as const;

export const MUTATING_MACRO = ["mutating", "macro"] as const;
