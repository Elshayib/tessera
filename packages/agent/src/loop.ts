import type {
  ChangeSet,
  CommandBus,
  JobQueue,
  QueryRegistry,
  TransactionHandle,
  TransactionRecord,
} from "@tessera/core";
import { isChangeSetEmpty } from "@tessera/core";
import type {
  LlmClient,
  LlmMessage,
  LlmResponse,
  LlmStreamEvent,
  ToolCallPart,
  ToolResultPart,
  ToolSpec,
} from "@tessera/llm";
import {
  assistantText,
  assistantToolCalls,
  systemMessage,
  toolResultMessage,
  userText,
} from "@tessera/llm";
import type { CheckSceneReader } from "@tessera/spatial";
import type { Clock, Logger, Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import { createBudget } from "./budget.js";
import { contextBudget, fitMessages } from "./compact.js";
import { asTesseraError } from "./errors.js";
import { applyPlan, executeStep, mergeChangeSets } from "./execute-step.js";
import { parseJsonModeTools } from "./json-mode.js";
import { defaultRunPolicy, mergeRunPolicy } from "./policy.js";
import { buildSystemPrompt, describeMaxChars } from "./prompts/build.js";
import type {
  RunEvent,
  RunRequest,
  SpatialCheckResult,
  UsageSummary,
  Verdict,
} from "./run-types.js";
import { selectTools } from "./tools/select.js";
import type { RunPolicy, ToolDefinition, ToolRegistry } from "./tools/types.js";
import type { TranscriptStore } from "./transcript/store.js";
import type { CapabilityProfile, ResolvedRoles } from "./types.js";
import { type Verifier, verificationFeedbackMessage, verificationHasIssues } from "./verifier.js";

const EMPTY_CHANGE_SET: ChangeSet = {
  entities: { created: [], deleted: [], updated: [] },
  assets: { created: [], deleted: [], updated: [] },
  behaviors: { created: [], deleted: [], updated: [] },
  summary: "No changes",
};

/**
 * Dependencies for one agent run (`06` §4).
 *
 * @public
 */
export interface LoopDeps {
  readonly bus: CommandBus;
  readonly queries: QueryRegistry;
  readonly jobs: JobQueue;
  readonly blobs: { has(hash: string): boolean };
  readonly tools: ToolRegistry;
  readonly llm: LlmClient;
  readonly logger: Logger;
  readonly clock: Clock;
  readonly verifier: Verifier;
  readonly profiles: Readonly<Record<string, CapabilityProfile>>;
  readonly roles: ResolvedRoles;
  readonly transcripts: TranscriptStore;
  readonly reader?: CheckSceneReader;
}

/**
 * Executes the observe → plan → act loop (`06` §4).
 *
 * @public
 */
export async function* runLoop(
  request: RunRequest,
  runId: string,
  cancelled: () => boolean,
  signal: AbortSignal | undefined,
  deps: LoopDeps,
): AsyncIterable<RunEvent> {
  const executorProfile = profileOf(deps, deps.roles.models.executor);
  const criticVision = deps.roles.criticEnabled && profileOf(deps, criticRef(deps.roles)).vision;
  const policy = mergeRunPolicy(defaultRunPolicy(executorProfile, criticVision), request.policy);
  const usage: UsageSummary = { inputTokens: 0, outputTokens: 0 };
  if (executorProfile.tools === "none") {
    yield {
      type: "run.failed",
      error: tesseraError("UNSUPPORTED", "executor has no tool protocol"),
      usage,
    };
    return;
  }
  const models = {
    planner: deps.roles.models.planner,
    executor: deps.roles.models.executor,
    critic: deps.roles.models.critic ?? deps.roles.models.executor,
  };
  yield { type: "run.started", runId, models, profile: executorProfile };
  const selected = [...selectTools(deps.tools, policy, executorProfile)];
  const jsonMode = executorProfile.tools === "json";
  const system = buildSystemPrompt({
    profile: executorProfile,
    tools: selected,
    jsonMode,
  });
  const outline = sceneOutline(deps.queries, executorProfile.contextTokens);
  const user = userPayload(request, outline);
  const tokenBudget = contextBudget(executorProfile.contextTokens, executorProfile.maxOutputTokens);
  const history = await deps.transcripts.recent(request.conversationId, tokenBudget);
  const prior = history.ok ? history.value.filter((message) => message.role !== "system") : [];
  let messages: LlmMessage[] = [systemMessage(system), ...prior, userText(user)];
  const budget = createBudget({
    policy,
    clock: deps.clock,
    startedAtMs: deps.clock.now(),
    ...(signal === undefined ? {} : { signal }),
  });
  const author = {
    kind: "agent" as const,
    id: deps.roles.models.executor.modelId,
    runId,
  };
  const records: TransactionRecord[] = [];
  let merged: ChangeSet = EMPTY_CHANGE_SET;
  const remainingIssues: string[] = [];
  let emptyStreak = 0;
  let jsonParseFails = 0;
  let stepIndex = 0;
  const distinctPlanner =
    deps.roles.models.planner.providerId !== deps.roles.models.executor.providerId ||
    deps.roles.models.planner.modelId !== deps.roles.models.executor.modelId;

  if (distinctPlanner) {
    yield { type: "step.started", stepIndex, role: "planner" };
    const planned = await modelStep(
      deps.llm,
      jsonMode,
      selected.filter((tool) => tool.name === "plan.set"),
      messages,
      policy,
      deps.roles.models.planner,
      stepIndex,
      budget,
      signal,
    );
    if (!planned.ok) {
      yield failOrCancel(planned.error, budget.snapshot(), cancelled);
      return;
    }
    yield* planned.value.deltas;
    const planCalls = planned.value.calls.filter((call) => call.name === "plan.set");
    if (planCalls[0] !== undefined) {
      const applied = applyPlan(planCalls[0].input);
      if (applied !== undefined) {
        yield { type: "plan.updated", items: applied };
      }
    }
    messages = appendTurn(messages, planned.value.response, [], executorProfile);
    stepIndex += 1;
  }

  let planItems: readonly { text: string; done: boolean }[] = [];
  let verification: {
    readonly spatial: SpatialCheckResult | null;
    readonly vision: Verdict | null;
  } = { spatial: null, vision: null };
  let repairRound = 0;
  const watchedJobs = new Set<string>();

  for (;;) {
    while (stepIndex < policy.maxSteps) {
      for (const jobId of [...watchedJobs]) {
        const status = deps.jobs.get(jobId);
        if (status === undefined) {
          continue;
        }
        if (
          status.state === "succeeded" ||
          status.state === "failed" ||
          status.state === "cancelled"
        ) {
          messages = [...messages, userText(`job.updated ${jobId} ${status.state}`)];
          watchedJobs.delete(jobId);
        }
      }
      const halt = haltRun(budget, cancelled);
      if (halt !== undefined && !halt.ok) {
        yield failOrCancel(halt.error, budget.snapshot(), cancelled);
        return;
      }
      yield { type: "step.started", stepIndex, role: "executor" };
      const fitted = fitMessages(
        messages,
        contextBudget(executorProfile.contextTokens, executorProfile.maxOutputTokens),
      );
      const stepped = await modelStep(
        deps.llm,
        jsonMode,
        selected,
        fitted,
        policy,
        deps.roles.models.executor,
        stepIndex,
        budget,
        signal,
      );
      if (!stepped.ok) {
        if (stepped.error.code === "INVALID_INPUT" && jsonMode) {
          jsonParseFails += 1;
          if (jsonParseFails >= 2) {
            yield {
              type: "run.failed",
              error: tesseraError("INVALID_INPUT", "two consecutive JSON-mode parse failures"),
              usage: budget.snapshot(),
            };
            return;
          }
          messages = [...fitted, userText("JSON-mode parse error. Emit a ```tool fence.")];
          stepIndex += 1;
          continue;
        }
        yield failOrCancel(stepped.error, budget.snapshot(), cancelled);
        return;
      }
      jsonParseFails = 0;
      yield* stepped.value.deltas;
      const calls = stepped.value.calls.slice(0, policy.maxToolCallsPerStep);
      const text = assistantPlainText(stepped.value.response);
      if (calls.length === 0) {
        if (text.trim() === "") {
          emptyStreak += 1;
          if (emptyStreak >= 2) {
            remainingIssues.push("model produced no actions");
            break;
          }
          stepIndex += 1;
          continue;
        }
        break;
      }
      emptyStreak = 0;
      const ctxBase = {
        runId,
        stepIndex,
        author,
        queries: deps.queries,
        jobs: deps.jobs,
        blobs: deps.blobs,
        policy,
        signal: signal ?? new AbortController().signal,
        logger: deps.logger,
      };
      const executed = await executeStep(
        deps.bus,
        deps.tools,
        selected,
        calls,
        ctxBase,
        deps.clock,
      );
      for (const event of executed.events) {
        yield event;
      }
      if (executed.plan !== undefined) {
        planItems = executed.plan;
        yield { type: "plan.updated", items: executed.plan };
      }
      if (executed.askUser !== undefined) {
        remainingIssues.push(executed.askUser);
      }
      if (executed.record !== undefined && !isChangeSetEmpty(executed.record.changeSet)) {
        yield { type: "transaction.committed", transaction: executed.record };
        records.push(executed.record);
        merged = mergeChangeSets(merged, executed.record.changeSet);
      }
      messages = appendTurn(fitted, stepped.value.response, executed.results, executorProfile);
      for (const part of executed.results) {
        const jobId = readJobId(part.result);
        if (jobId !== undefined) {
          watchedJobs.add(jobId);
        }
      }
      await settleJobs(deps.jobs, watchedJobs);
      stepIndex += 1;
      if (executed.askUser !== undefined) {
        break;
      }
    }

    const mutated = records.length > 0;
    if (policy.verify === "none" || !mutated) {
      break;
    }
    yield { type: "verify.started", round: repairRound, mode: "spatial" };
    const dummyTx: TransactionHandle = {
      id: "t_verify000",
      run: () => err(tesseraError("UNSUPPORTED", "verify")),
    };
    const criticProfile = profileOf(deps, criticRef(deps.roles));
    const verified = await deps.verifier.verify({
      policy,
      mutated,
      queries: deps.queries,
      tx: dummyTx,
      changedEntities: changedEntityIds(merged),
      prompt: `${request.prompt}\nplan:${JSON.stringify(planItems)}`,
      ...(deps.reader === undefined ? {} : { reader: deps.reader }),
      llm: deps.llm,
      ...(deps.roles.criticEnabled ? { critic: { profile: criticProfile } } : {}),
    });
    if (!verified.ok) {
      remainingIssues.push(verified.error.message);
      break;
    }
    verification = verified.value;
    if (policy.verify === "spatial+vision" && criticVision) {
      yield { type: "verify.started", round: repairRound, mode: "vision" };
    }
    yield {
      type: "verify.result",
      round: repairRound,
      verdict: verdictFrom(verification.spatial, verification.vision),
    };
    if (!verificationHasIssues(verification.spatial, verification.vision)) {
      break;
    }
    if (repairRound >= policy.maxRepairRounds) {
      remainingIssues.push("verification issues remain");
      break;
    }
    messages = [
      ...messages,
      userText(verificationFeedbackMessage(verification.spatial, verification.vision)),
    ];
    repairRound += 1;
  }

  const summary = lastAssistantText(messages).slice(0, 600);
  yield {
    type: "run.completed",
    report: {
      summary: stripToolNames(summary),
      transactions: records.map((record) => record.id),
      changeSet: merged,
      verification,
      remainingIssues,
      suggestions: [],
    },
    usage: budget.snapshot(),
  };
}

function changedEntityIds(changeSet: ChangeSet): readonly string[] {
  const ids = [...changeSet.entities.created, ...changeSet.entities.updated.map((item) => item.id)];
  return [...new Set(ids)];
}

function verdictFrom(spatial: SpatialCheckResult | null, vision: Verdict | null): Verdict {
  if (vision !== null) {
    return vision;
  }
  const issues =
    spatial === null
      ? []
      : spatial.issues.map((item) => ({
          entity: item.entity,
          problem: item.message,
          suggestion: item.suggestedTool === undefined ? "" : item.suggestedTool.name,
        }));
  return {
    pass: issues.length === 0,
    score: issues.length === 0 ? 5 : 1,
    issues,
  };
}

function profileOf(
  deps: LoopDeps,
  ref: { providerId: string; modelId: string },
): CapabilityProfile {
  const key = `${ref.providerId}:${ref.modelId}`;
  const found = deps.profiles[key];
  if (found !== undefined) {
    return found;
  }
  return {
    ref,
    tools: "native",
    parallelTools: false,
    vision: false,
    structuredOutput: false,
    streaming: true,
    contextTokens: 32_000,
    maxTools: 64,
    needsExamples: false,
    maxOutputTokens: 4_000,
  };
}

function criticRef(roles: ResolvedRoles): { providerId: string; modelId: string } {
  return roles.models.critic ?? roles.models.executor;
}

function sceneOutline(queries: QueryRegistry, contextTokens: number): string {
  const maxChars = describeMaxChars(contextTokens);
  const runner = Reflect.get(queries, "query");
  if (typeof runner !== "function") {
    return "";
  }
  const result: unknown = runner.call(queries, "scene.describe", {
    detail: "outline",
    maxChars,
  });
  if (!isQueryText(result)) {
    return "";
  }
  return result.value.text;
}

function isQueryText(value: unknown): value is { ok: true; value: { text: string } } {
  if (typeof value !== "object" || value === null || !("ok" in value) || value.ok !== true) {
    return false;
  }
  if (!("value" in value) || typeof value.value !== "object" || value.value === null) {
    return false;
  }
  if (!("text" in value.value) || typeof value.value.text !== "string") {
    return false;
  }
  return true;
}

async function settleJobs(jobs: LoopDeps["jobs"], ids: ReadonlySet<string>): Promise<void> {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    let pending = false;
    for (const id of ids) {
      const status = jobs.get(id);
      if (status !== undefined && (status.state === "queued" || status.state === "running")) {
        pending = true;
      }
    }
    if (!pending) {
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });
  }
}

function readJobId(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const record: Record<string, unknown> = { ...value };
  const key = "jobId";
  const jobId = record[key];
  return typeof jobId === "string" ? jobId : undefined;
}

function userPayload(request: RunRequest, outline: string): string {
  const selection = request.context.selection.join(", ");
  const camera = request.context.viewportCamera;
  const focused = request.context.focusedEntity ?? "";
  const pose =
    camera === undefined
      ? ""
      : `viewportCamera position=${camera.position.join(",")} rotation=${(camera.rotation ?? []).join(",")}`;
  return `${request.prompt}\n\nScene outline:\n${outline}\nselection: ${selection}\nfocusedEntity: ${focused}\n${pose}`;
}

function haltRun(
  budget: ReturnType<typeof createBudget>,
  cancelled: () => boolean,
): Result<never, TesseraError> | undefined {
  if (cancelled()) {
    return err(tesseraError("CANCELLED", "run cancelled"));
  }
  const checked = budget.check();
  if (checked.ok) {
    return undefined;
  }
  return err(checked.error);
}

function failOrCancel(
  error: TesseraError,
  usage: UsageSummary,
  cancelled: () => boolean,
): RunEvent {
  if (cancelled() || error.code === "CANCELLED") {
    return { type: "run.cancelled", usage };
  }
  return { type: "run.failed", error, usage };
}

type ModelStepOk = {
  readonly response: LlmResponse;
  readonly calls: readonly ToolCallPart[];
  readonly deltas: readonly RunEvent[];
};

async function modelStep(
  llm: LlmClient,
  jsonMode: boolean,
  tools: readonly ToolDefinition[],
  messages: readonly LlmMessage[],
  policy: RunPolicy,
  model: { providerId: string; modelId: string },
  stepIndex: number,
  budget: ReturnType<typeof createBudget>,
  signal: AbortSignal | undefined,
): Promise<Result<ModelStepOk, TesseraError>> {
  const specs = jsonMode ? undefined : toSpecs(tools);
  let last: TesseraError | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const deltas: RunEvent[] = [];
    let response: LlmResponse | undefined;
    try {
      const request =
        specs === undefined
          ? {
              model,
              messages,
              temperature: policy.temperature,
              metadata: { runId: "", stepIndex },
            }
          : {
              model,
              messages,
              tools: specs,
              temperature: policy.temperature,
              metadata: { runId: "", stepIndex },
            };
      for await (const event of llm.stream(request, signal)) {
        const mapped = onStream(event, stepIndex);
        if (mapped.delta !== undefined) {
          deltas.push(mapped.delta);
        }
        if (mapped.done !== undefined) {
          response = mapped.done;
        }
      }
    } catch (caught) {
      const error = asTesseraError(caught);
      if (error?.code === "RATE_LIMITED") {
        last = error;
        continue;
      }
      return err(error ?? tesseraError("PROVIDER_ERROR", "stream failed"));
    }
    if (response === undefined) {
      return err(tesseraError("PROVIDER_ERROR", "stream ended without done"));
    }
    budget.add(response.usage);
    const calls = jsonMode
      ? parseJsonCalls(assistantPlainText(response), textOnly(response))
      : toolCallsOf(response);
    if (!calls.ok) {
      return calls;
    }
    return ok({ response, calls: calls.value, deltas });
  }
  return err(last ?? tesseraError("RATE_LIMITED", "rate limited"));
}

function parseJsonCalls(
  text: string,
  allowEmpty: boolean,
): Result<readonly ToolCallPart[], TesseraError> {
  if (allowEmpty && !text.includes("```tool")) {
    return ok([]);
  }
  return parseJsonModeTools(text);
}

function textOnly(response: LlmResponse): boolean {
  return toolCallsOfOk(response).length === 0 && assistantPlainText(response).trim().length > 0;
}

function onStream(
  event: LlmStreamEvent,
  stepIndex: number,
): { delta?: RunEvent; done?: LlmResponse } {
  if (event.type === "text.delta") {
    return { delta: { type: "model.delta", stepIndex, text: event.text } };
  }
  if (event.type === "done") {
    return { done: event.response };
  }
  return {};
}

function toSpecs(tools: readonly ToolDefinition[]): readonly ToolSpec[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: { type: "object" },
  }));
}

function toolCallsOf(response: LlmResponse): Result<readonly ToolCallPart[], TesseraError> {
  return ok(toolCallsOfOk(response));
}

function toolCallsOfOk(response: LlmResponse): readonly ToolCallPart[] {
  const parts = response.message.role === "assistant" ? response.message.parts : [];
  return parts.filter((part): part is ToolCallPart => part.kind === "toolCall");
}

function assistantPlainText(response: LlmResponse): string {
  if (response.message.role !== "assistant") {
    return "";
  }
  return response.message.parts
    .filter((part): part is { kind: "text"; text: string } => part.kind === "text")
    .map((part) => part.text)
    .join("");
}

function appendTurn(
  messages: readonly LlmMessage[],
  response: LlmResponse,
  results: readonly ToolResultPart[],
  profile: CapabilityProfile,
): LlmMessage[] {
  const assistant =
    toolCallsOfOk(response).length > 0
      ? assistantToolCalls(toolCallsOfOk(response))
      : assistantText(assistantPlainText(response));
  const next = [...messages, assistant];
  if (results.length > 0) {
    next.push(toolResultMessage(results));
  }
  return [...fitMessages(next, contextBudget(profile.contextTokens, profile.maxOutputTokens))];
}

function lastAssistantText(messages: readonly LlmMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant") {
      return message.parts
        .filter((part): part is { kind: "text"; text: string } => part.kind === "text")
        .map((part) => part.text)
        .join("");
    }
  }
  return "";
}

function stripToolNames(summary: string): string {
  return summary.replace(/\b(entity|scene|layout|camera|tools|plan)\.[A-Za-z]+\b/g, "the editor");
}
