import {
  buildRunTrace,
  type CapabilityProfile,
  createAgentRuntime,
  createSkipVerifier,
  createToolRegistry,
  defaultRunPolicy,
  mergeRunPolicy,
  type RunEvent,
  type RunReport,
} from "@tessera/agent";
import {
  createCommandBus,
  createDocument,
  createJobQueue,
  createQueryHost,
  createUndoService,
  fromYDoc,
} from "@tessera/core";
import type { LlmClient, ModelRef } from "@tessera/llm";
import { createLogger, type TesseraError } from "@tessera/std";
import { docBuilder, FakeClock, type LlmRecording, ReplayLlmClient } from "@tessera/testing";
import { CORE_EVAL_CASES } from "../suites/core/core-20.eval.js";
import { installSeededCrypto, seedFromKey } from "./seed-crypto.js";
import type { EvalCase, EvalContext } from "./types.js";

/**
 * CLI flags from `13` §5.2.
 *
 * @public
 */
export interface EvalCliOptions {
  readonly suite: string;
  readonly model: string;
  readonly mode: "replay" | "live";
  readonly judge?: string;
  readonly report?: string;
  readonly ci?: boolean;
}

/**
 * One case result.
 *
 * @public
 */
export interface CaseResult {
  readonly id: string;
  readonly scored: boolean;
  readonly hardScore: number;
  readonly error?: string;
  readonly assertions: readonly { readonly name: string; readonly pass: boolean }[];
}

/**
 * True when a case is scored in phase-2 replay (Q-0131).
 *
 * @public
 */
export function isScoredPhase2(evalCase: EvalCase): boolean {
  const tags = evalCase.tags ?? [];
  return tags.includes("core-20") && !tags.includes("needs-generation");
}

/**
 * Parses `pnpm eval` argv (`13` §5.2).
 *
 * @example
 * ```ts
 * parseEvalArgs(["--mode", "replay"]);
 * ```
 *
 * @public
 */
export function parseEvalArgs(argv: readonly string[]): EvalCliOptions {
  let suite = "core";
  let model = "fake/fake";
  let mode: "replay" | "live" = "replay";
  let judge: string | undefined;
  let report: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === "--suite" && next !== undefined) {
      suite = next;
      i += 1;
    } else if (flag === "--model" && next !== undefined) {
      model = next;
      i += 1;
    } else if (flag === "--mode" && next !== undefined && (next === "replay" || next === "live")) {
      mode = next;
      i += 1;
    } else if (flag === "--judge" && next !== undefined) {
      judge = next;
      i += 1;
    } else if (flag === "--report" && next !== undefined) {
      report = next;
      i += 1;
    }
  }
  return {
    suite,
    model,
    mode,
    ...(judge === undefined ? {} : { judge }),
    ...(report === undefined ? {} : { report }),
  };
}

/**
 * Mean hard score over scored cases; skipped `needs-generation` is omitted.
 *
 * @public
 */
export function scoreResults(results: readonly CaseResult[]): number {
  const scored = results.filter((row) => row.scored);
  if (scored.length === 0) {
    return 0;
  }
  return scored.reduce((sum, row) => sum + row.hardScore, 0) / scored.length;
}

function parseModel(model: string): ModelRef {
  const slash = model.indexOf("/");
  if (slash <= 0) {
    return { providerId: "fake", modelId: model };
  }
  return { providerId: model.slice(0, slash), modelId: model.slice(slash + 1) };
}

const FAKE_PROFILE: CapabilityProfile = {
  ref: { providerId: "fake", modelId: "fake" },
  tools: "native",
  parallelTools: true,
  vision: false,
  structuredOutput: true,
  streaming: true,
  contextTokens: 128_000,
  maxTools: 64,
  needsExamples: false,
  maxOutputTokens: 4_000,
};

function emptyReport(errorMessage: string): RunReport {
  return {
    summary: errorMessage,
    transactions: [],
    changeSet: {
      entities: { created: [], deleted: [], updated: [] },
      assets: { created: [], deleted: [], updated: [] },
      behaviors: { created: [], deleted: [], updated: [] },
      summary: "",
    },
    verification: { spatial: null, vision: null },
    remainingIssues: [],
    suggestions: [],
  };
}

function hardScoreOf(
  assertions: readonly { readonly pass: boolean; readonly weight?: number }[],
): number {
  const total = assertions.reduce((sum, row) => sum + (row.weight ?? 1), 0);
  if (total === 0) {
    return 1;
  }
  const passed = assertions.reduce((sum, row) => sum + (row.pass ? (row.weight ?? 1) : 0), 0);
  return passed / total;
}

/**
 * Runs the core suite in replay or live (`13` §5.2).
 *
 * @public
 */
export async function runEvals(options: {
  readonly cli: EvalCliOptions;
  readonly cases?: readonly EvalCase[];
  readonly recordings?: readonly LlmRecording[];
  readonly writeLeaderboard?: (text: string) => void;
  readonly llm?: LlmClient;
}): Promise<{ readonly results: readonly CaseResult[]; readonly leaderboardWritten: boolean }> {
  if (options.cli.mode === "live" && options.cli.ci === true) {
    throw new Error("live mode is not invoked by CI");
  }
  const model = parseModel(options.cli.model);
  const llm = options.llm ?? new ReplayLlmClient({ recordings: options.recordings ?? [] });
  const cases = options.cases ?? CORE_EVAL_CASES.filter(() => options.cli.suite === "core");
  const results: CaseResult[] = [];
  for (const evalCase of cases) {
    const variants: Partial<{ confirmDestructive: boolean }>[] =
      evalCase.id === "core.delete-trees"
        ? [{ confirmDestructive: false }, { confirmDestructive: true }]
        : [{}];
    for (const variant of variants) {
      results.push(await runOne(evalCase, llm, model, variant));
    }
  }
  if (options.cli.mode === "live" && options.writeLeaderboard !== undefined) {
    options.writeLeaderboard("# leaderboard\n");
    return { results, leaderboardWritten: true };
  }
  return { results, leaderboardWritten: false };
}

async function runOne(
  evalCase: EvalCase,
  llm: LlmClient,
  model: ModelRef,
  variant: Partial<{ confirmDestructive: boolean }>,
): Promise<CaseResult> {
  const restore = installSeededCrypto(
    seedFromKey(`${evalCase.id}|${model.providerId}|${model.modelId}`),
  );
  try {
    return await runOneUnseeded(evalCase, llm, model, variant);
  } finally {
    restore();
  }
}

async function runOneUnseeded(
  evalCase: EvalCase,
  llm: LlmClient,
  model: ModelRef,
  variant: Partial<{ confirmDestructive: boolean }>,
): Promise<CaseResult> {
  const before = evalCase.setup(docBuilder);
  const created = createDocument({ snapshot: before });
  const undo = createUndoService(created.doc);
  const bus = createCommandBus(created.doc, { undo: undo.capture });
  const host = createQueryHost(created.doc, { history: () => undo.committed() });
  const queries = Object.assign(host.registry, { query: host.query.bind(host) });
  const jobs = createJobQueue(bus, { logger: created.doc.logger });
  const tools = createToolRegistry();
  tools.deriveFromRegistries(bus.registry, queries);
  const profile = { ...FAKE_PROFILE, ref: model };
  const runtime = createAgentRuntime({
    bus,
    queries,
    jobs,
    tools,
    llm,
    roles: { models: { planner: model, executor: model }, criticEnabled: false },
    profiles: { [`${model.providerId}:${model.modelId}`]: profile },
    logger: createLogger([]),
    clock: new FakeClock(),
    verifier: createSkipVerifier(),
    reader: created.reader,
  });
  const policy = mergeRunPolicy(defaultRunPolicy(profile, false), {
    ...evalCase.policy,
    ...variant,
    verify: "none",
    maxSteps: evalCase.policy?.maxSteps ?? 8,
  });
  const events: RunEvent[] = [];
  let failed: TesseraError | undefined;
  for await (const event of runtime.run({
    conversationId: `eval-${evalCase.id}`,
    prompt: evalCase.prompt,
    context: { selection: [] },
    policy,
  })) {
    events.push(event);
    if (event.type === "run.failed") {
      failed = event.error;
    }
  }
  const after = fromYDoc(created.doc.ydoc);
  const completed = events.find((event) => event.type === "run.completed");
  const report: RunReport =
    completed?.type === "run.completed"
      ? completed.report
      : emptyReport(failed?.message ?? "run incomplete");
  const trace = buildRunTrace({
    events,
    conversationId: `eval-${evalCase.id}`,
    startedAt: "2020-01-01T00:00:00.000Z",
    endedAt: "2020-01-01T00:00:01.000Z",
    policy,
    fallbackProfile: profile,
  });
  const ctx: EvalContext = { before, after, report, trace, screenshots: [] };
  if (failed !== undefined) {
    return {
      id: evalCase.id,
      scored: isScoredPhase2(evalCase),
      hardScore: 0,
      error: failed.message,
      assertions: [],
    };
  }
  const assertions = evalCase.assertions(ctx);
  return {
    id: evalCase.id,
    scored: isScoredPhase2(evalCase),
    hardScore: hardScoreOf(assertions),
    assertions: assertions.map((row) => ({ name: row.name, pass: row.pass })),
  };
}
