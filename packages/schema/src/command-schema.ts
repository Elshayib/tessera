import type { z } from "zod";

type CommandTier = 1 | 2 | 3 | 4;

type CommandTag = "mutating" | "macro" | "job" | "engine";

type QueryTag = "engine" | "expensive";

/**
 * Command catalog entry (`docs/04-command-bus.md` §3). Handlers live in `@tessera/core`.
 */
export interface CommandSchema<I = unknown, O = unknown> {
  readonly name: string;
  readonly description: string;
  readonly input: z.ZodType<I>;
  readonly output: z.ZodType<O>;
  readonly tier: CommandTier;
  readonly tags: readonly CommandTag[];
}

/**
 * Query catalog entry without `handle` (T-0008 registers handlers).
 */
export interface QuerySchema<I = unknown, O = unknown> {
  readonly name: string;
  readonly description: string;
  readonly input: z.ZodType<I>;
  readonly output: z.ZodType<O>;
  readonly tags: readonly QueryTag[];
}
