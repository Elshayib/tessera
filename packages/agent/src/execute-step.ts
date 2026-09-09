import type { ChangeSet, CommandBus, TransactionHandle, TransactionRecord } from "@tessera/core";
import type { ToolCallPart, ToolResultPart } from "@tessera/llm";
import type { Clock, Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import { compactValue } from "./compact.js";
import { abortFrom, asTesseraError } from "./errors.js";
import type { RunEvent } from "./run-types.js";
import { denyIfDestructive } from "./tools/destructive.js";
import { attachSuggestion } from "./tools/suggestions.js";
import type { ToolContext, ToolDefinition, ToolRegistry } from "./tools/types.js";

/**
 * Runs one step's tool calls inside a single transaction (`06` §7.1, Q-0139).
 *
 * @public
 */
export function executeStep(
  bus: CommandBus,
  registry: ToolRegistry,
  selected: readonly ToolDefinition[],
  calls: readonly ToolCallPart[],
  base: Omit<ToolContext, "tx">,
  clock: Clock,
): {
  readonly events: RunEvent[];
  readonly results: ToolResultPart[];
  readonly record: TransactionRecord | undefined;
  readonly plan: readonly { text: string; done: boolean }[] | undefined;
  readonly askUser: string | undefined;
} {
  const events: RunEvent[] = [];
  const results: ToolResultPart[] = [];
  let plan: readonly { text: string; done: boolean }[] | undefined;
  let askUser: string | undefined;
  const outcome = bus.transaction(
    { author: base.author, runId: base.runId, label: "agent-step" },
    (tx) => {
      const ctx: ToolContext = { ...base, tx };
      for (const call of calls) {
        events.push({
          type: "tool.called",
          stepIndex: base.stepIndex,
          callId: call.callId,
          name: call.name,
          input: call.input,
        });
        const tool = selected.find((item) => item.name === call.name) ?? registry.get(call.name);
        const began = clock.now();
        const result =
          tool === undefined
            ? err(tesseraError("NOT_FOUND", `unknown tool ${call.name}`))
            : dispatchTool(tool, call.input, ctx, registry);
        const durationMs = clock.now() - began;
        const summary = result.ok
          ? JSON.stringify(compactValue(result.value)).slice(0, 400)
          : result.error.message;
        events.push({
          type: "tool.result",
          stepIndex: base.stepIndex,
          callId: call.callId,
          ok: result.ok,
          summary,
          durationMs,
        });
        results.push({
          callId: call.callId,
          name: call.name,
          result: result.ok ? compactValue(result.value) : result.error,
          isError: !result.ok,
        });
        if (call.name === "plan.set" && result.ok) {
          plan = applyPlan(result.value);
        }
        if (call.name === "ask_user" && result.ok) {
          const question = questionOf(result.value);
          if (question !== undefined) {
            askUser = question;
          }
        }
      }
      return ok(undefined);
    },
  );
  if (!outcome.ok) {
    return { events, results, record: undefined, plan, askUser };
  }
  return { events, results, record: outcome.value.transaction, plan, askUser };
}

/**
 * Parses `plan.set` output (`06` §4).
 *
 * @public
 */
export function applyPlan(value: unknown): readonly { text: string; done: boolean }[] | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    !("items" in value) ||
    !Array.isArray(value.items)
  ) {
    return undefined;
  }
  const items: { text: string; done: boolean }[] = [];
  for (const item of value.items) {
    if (typeof item !== "object" || item === null || !("text" in item) || !("done" in item)) {
      continue;
    }
    if (typeof item.text === "string" && typeof item.done === "boolean") {
      items.push({ text: item.text, done: item.done });
    }
  }
  return items;
}

/**
 * Merges run-level change sets.
 *
 * @public
 */
export function mergeChangeSets(left: ChangeSet, right: ChangeSet): ChangeSet {
  return {
    entities: {
      created: [...left.entities.created, ...right.entities.created],
      deleted: [...left.entities.deleted, ...right.entities.deleted],
      updated: [...left.entities.updated, ...right.entities.updated],
    },
    assets: {
      created: [...left.assets.created, ...right.assets.created],
      deleted: [...left.assets.deleted, ...right.assets.deleted],
      updated: [...left.assets.updated, ...right.assets.updated],
    },
    behaviors: {
      created: [...left.behaviors.created, ...right.behaviors.created],
      deleted: [...left.behaviors.deleted, ...right.behaviors.deleted],
      updated: [...left.behaviors.updated, ...right.behaviors.updated],
    },
    summary: right.summary,
  };
}

function questionOf(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("question" in value)) {
    return undefined;
  }
  const question = value.question;
  return typeof question === "string" ? question : undefined;
}

function dispatchTool(
  tool: ToolDefinition,
  input: unknown,
  ctx: ToolContext,
  registry: ToolRegistry,
): Result<unknown, TesseraError> {
  const parsed = tool.input.safeParse(input);
  if (!parsed.success) {
    return attachSuggestion(tool.group, err(tesseraError("INVALID_INPUT", "invalid tool input")));
  }
  const blocked = denyIfDestructive(tool.destructive, ctx.policy.confirmDestructive);
  if (!blocked.ok) {
    return err(blocked.error);
  }
  if (tool.group === "meta") {
    return runMeta(tool.name, parsed.data, registry);
  }
  if (tool.group === "read") {
    return runQueryTool(tool.name, parsed.data, ctx);
  }
  return runCatching(ctx.tx, tool.name, parsed.data);
}

function runQueryTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Result<unknown, TesseraError> {
  const runner = Reflect.get(ctx.queries, "query");
  if (typeof runner !== "function") {
    return err(tesseraError("UNSUPPORTED", "queries cannot execute"));
  }
  const result: unknown = runner.call(ctx.queries, name, input);
  if (isToolResult(result)) {
    return result;
  }
  return err(tesseraError("INVARIANT_VIOLATION", "query did not return Result"));
}

function runMeta(
  name: string,
  input: unknown,
  registry: ToolRegistry,
): Result<unknown, TesseraError> {
  if (name === "plan.set" || name === "ask_user") {
    return ok(input);
  }
  if (name === "tools.catalog") {
    return ok({
      tools: registry.list().map((item) => ({
        name: item.name,
        group: item.group,
        tier: item.tier,
        description: item.description,
      })),
    });
  }
  if (name === "tools.enable") {
    const group = groupFrom(input);
    if (group === undefined) {
      return err(tesseraError("INVALID_INPUT", "tools.enable needs a group"));
    }
    return registry.enableGroup(group);
  }
  return err(tesseraError("UNSUPPORTED", name));
}

function groupFrom(input: unknown): ToolDefinition["group"] | undefined {
  if (typeof input !== "object" || input === null || !("group" in input)) {
    return undefined;
  }
  const group = input.group;
  if (typeof group !== "string") {
    return undefined;
  }
  const allowed: readonly ToolDefinition["group"][] = [
    "read",
    "entities",
    "components",
    "materials",
    "assets",
    "layout",
    "camera",
    "environment",
    "generate",
    "code",
    "meta",
  ];
  return allowed.find((item) => item === group);
}

function runCatching(
  tx: TransactionHandle,
  name: string,
  input: unknown,
): Result<unknown, TesseraError> {
  try {
    return tx.run(name, input);
  } catch (caught) {
    const error = asTesseraError(caught) ?? abortFrom(caught);
    if (error !== undefined) {
      return err(error);
    }
    throw caught;
  }
}

function isToolResult(value: unknown): value is Result<unknown, TesseraError> {
  if (typeof value !== "object" || value === null || !("ok" in value)) {
    return false;
  }
  return value.ok === true || value.ok === false;
}
