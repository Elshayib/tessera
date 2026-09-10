import type {
  Author,
  BlobPresence,
  CommandRegistry,
  JobQueue,
  QueryRegistry,
  TransactionHandle,
} from "@tessera/core";
import type { Logger, Result, TesseraError } from "@tessera/std";
import type { z } from "zod";

/**
 * Tool groups from `06` §3.
 *
 * @public
 */
export type ToolGroup =
  | "read"
  | "entities"
  | "components"
  | "materials"
  | "assets"
  | "layout"
  | "camera"
  | "environment"
  | "generate"
  | "code"
  | "meta";

/**
 * Run limits and safety (`06` §3). Phase 2 defaults `enabledTiers` to `[0,1,2]` (Q-0126).
 *
 * @public
 */
export interface RunPolicy {
  readonly enabledTiers: readonly (0 | 1 | 2 | 3 | 4)[];
  readonly maxSteps: number;
  readonly maxToolCallsPerStep: number;
  readonly maxInputTokens: number;
  readonly maxEstimatedCostUsd?: number;
  readonly timeoutMs: number;
  readonly verify: "none" | "spatial" | "spatial+vision";
  readonly maxRepairRounds: number;
  readonly confirmDestructive: boolean;
  readonly temperature: number;
}

/**
 * One agent tool (`06` §3).
 *
 * @public
 */
export interface ToolDefinition<I = unknown, O = unknown> {
  readonly name: string;
  readonly description: string;
  readonly tier: 0 | 1 | 2 | 3 | 4;
  readonly group: ToolGroup;
  readonly input: z.ZodType<I>;
  readonly output: z.ZodType<O>;
  readonly destructive: boolean;
  execute(input: I, ctx: ToolContext): Promise<Result<O, TesseraError>>;
}

/**
 * Per-call tool environment (`06` §3).
 *
 * @public
 */
export interface ToolContext {
  readonly runId: string;
  readonly stepIndex: number;
  readonly author: Author;
  readonly tx: TransactionHandle;
  readonly queries: QueryRegistry;
  readonly jobs: JobQueue;
  readonly blobs: BlobPresence;
  readonly policy: RunPolicy;
  readonly signal: AbortSignal;
  readonly logger: Logger;
}

/**
 * Derived + registered tools (`06` §3).
 *
 * @public
 */
export interface ToolRegistry {
  register(tool: ToolDefinition): void;
  list(filter?: {
    tiers?: readonly number[];
    groups?: readonly string[];
  }): readonly ToolDefinition[];
  get(name: string): ToolDefinition | undefined;
  deriveFromRegistries(commands: CommandRegistry, queries: QueryRegistry): void;
  enableGroup(group: ToolGroup): Result<void, TesseraError>;
  enabledGroups(): ReadonlySet<ToolGroup>;
}
