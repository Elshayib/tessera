import type { BlobPresence, CommandBus, JobQueue, QueryRegistry } from "@tessera/core";
import type { LlmClient } from "@tessera/llm";
import type { CheckSceneReader } from "@tessera/spatial";
import type { Clock, Logger } from "@tessera/std";
import { newId, systemClock } from "@tessera/std";
import type { LoopDeps } from "./loop.js";
import { runLoop } from "./loop.js";
import type { RunEvent, RunRequest } from "./run-types.js";
import type { ToolRegistry } from "./tools/types.js";
import type { CapabilityProfile, ResolvedRoles } from "./types.js";
import { createSkipVerifier, type Verifier } from "./verifier.js";

/**
 * Streaming agent runtime (`06` §3–§4).
 *
 * @public
 */
export interface AgentRuntime {
  run(request: RunRequest, signal?: AbortSignal): AsyncIterable<RunEvent>;
  cancel(runId: string): void;
  readonly tools: ToolRegistry;
}

/**
 * Creates {@link AgentRuntime}.
 *
 * @example
 * ```ts
 * const runtime = createAgentRuntime({ bus, queries, jobs, tools, llm, roles, profiles });
 * ```
 *
 * @public
 */
export function createAgentRuntime(input: {
  readonly bus: CommandBus;
  readonly queries: QueryRegistry;
  readonly jobs: JobQueue;
  readonly tools: ToolRegistry;
  readonly llm: LlmClient;
  readonly roles: ResolvedRoles;
  readonly profiles: Readonly<Record<string, CapabilityProfile>>;
  readonly logger: Logger;
  readonly clock?: Clock;
  readonly blobs?: BlobPresence;
  readonly verifier?: Verifier;
  readonly newRunId?: () => string;
  readonly reader?: CheckSceneReader;
}): AgentRuntime {
  const cancelled = new Set<string>();
  const blobs = input.blobs ?? { has: () => true };
  const verifier = input.verifier ?? createSkipVerifier();
  const clock = input.clock ?? systemClock;
  const newRunId = input.newRunId ?? (() => newId("r"));
  return {
    tools: input.tools,
    cancel(runId) {
      cancelled.add(runId);
    },
    run(request, signal) {
      const runId = newRunId();
      const deps: LoopDeps = {
        bus: input.bus,
        queries: input.queries,
        jobs: input.jobs,
        blobs,
        tools: input.tools,
        llm: input.llm,
        logger: input.logger,
        clock,
        verifier,
        profiles: input.profiles,
        roles: input.roles,
        ...(input.reader === undefined ? {} : { reader: input.reader }),
      };
      return runLoop(
        request,
        runId,
        () => cancelled.has(runId) || (signal?.aborted ?? false),
        signal,
        deps,
      );
    },
  };
}
