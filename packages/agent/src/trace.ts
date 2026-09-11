import type { ModelRef } from "@tessera/llm";
import type { RunEvent, UsageSummary } from "./run-types.js";
import type { RunPolicy } from "./tools/types.js";
import type { CapabilityProfile, Role } from "./types.js";

/**
 * OpenTelemetry-compatible span names (`15` §4).
 *
 * @public
 */
export type SpanName =
  | "run"
  | "step"
  | "model.call"
  | "tool.call"
  | "verify.spatial"
  | "verify.vision"
  | "transaction";

/**
 * One span in a {@link RunTrace} (`15` §4).
 *
 * @public
 */
export interface Span {
  readonly id: string;
  readonly parentId?: string;
  readonly name: SpanName;
  readonly start: number;
  readonly end: number;
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
  readonly events?: readonly {
    readonly time: number;
    readonly name: string;
    readonly attributes?: Record<string, unknown>;
  }[];
}

/**
 * Finished-run trace (`15` §4, `INV-OBS-03`).
 *
 * @public
 */
export interface RunTrace {
  readonly runId: string;
  readonly conversationId: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly models: Record<Role, ModelRef>;
  readonly profile: CapabilityProfile;
  readonly policy: RunPolicy;
  readonly spans: readonly Span[];
  readonly usage: UsageSummary;
  readonly outcome: "completed" | "failed" | "cancelled";
}

const EMPTY_USAGE: UsageSummary = { inputTokens: 0, outputTokens: 0 };

/**
 * Builds a {@link RunTrace} from streamed {@link RunEvent}s (`INV-OBS-03`).
 *
 * @example
 * ```ts
 * buildRunTrace({ events, conversationId, startedAt, endedAt, policy });
 * ```
 *
 * @public
 */
export function buildRunTrace(input: {
  readonly events: readonly RunEvent[];
  readonly conversationId: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly policy: RunPolicy;
  readonly fallbackProfile: CapabilityProfile;
}): RunTrace {
  const started = input.events.find((event) => event.type === "run.started");
  const runId = started?.runId ?? "r_unknown000";
  const models = started?.models ?? emptyModels(input.fallbackProfile.ref);
  const profile = started?.profile ?? input.fallbackProfile;
  const spans: Span[] = [];
  const runSpanId = "span_run";
  let cursor = 0;
  spans.push({
    id: runSpanId,
    name: "run",
    start: 0,
    end: 0,
    attributes: { runId },
  });
  for (const event of input.events) {
    if (event.type === "step.started") {
      const start = cursor;
      cursor += 1;
      spans.push({
        id: `span_step_${String(event.stepIndex)}`,
        parentId: runSpanId,
        name: "step",
        start,
        end: start + 1,
        attributes: { stepIndex: event.stepIndex, role: event.role },
      });
    }
  }
  const last = input.events[input.events.length - 1];
  const outcome = terminalOutcome(last);
  const usage = terminalUsage(last);
  const ended = Math.max(cursor, 1);
  const withEnd: Span[] = spans.map((span) =>
    span.name === "run" ? { ...span, end: ended } : span,
  );
  return {
    runId,
    conversationId: input.conversationId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    models,
    profile,
    policy: input.policy,
    spans: withEnd,
    usage,
    outcome,
  };
}

function emptyModels(ref: ModelRef): Record<Role, ModelRef> {
  return { planner: ref, executor: ref, critic: ref };
}

function terminalOutcome(event: RunEvent | undefined): RunTrace["outcome"] {
  if (event?.type === "run.failed") {
    return "failed";
  }
  if (event?.type === "run.cancelled") {
    return "cancelled";
  }
  return "completed";
}

function terminalUsage(event: RunEvent | undefined): UsageSummary {
  if (
    event?.type === "run.completed" ||
    event?.type === "run.failed" ||
    event?.type === "run.cancelled"
  ) {
    return event.usage;
  }
  return EMPTY_USAGE;
}
