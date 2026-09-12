import type { CommandDefinition, QueryDefinition, QueryRegistry } from "@tessera/core";
import type { Result, TesseraError } from "@tessera/std";
import { err, tesseraError } from "@tessera/std";
import type { z } from "zod";
import { denyIfDestructive, isDestructiveCommand } from "./destructive.js";
import { attachSuggestion } from "./suggestions.js";
import type { ToolContext, ToolDefinition, ToolGroup } from "./types.js";

const OMITTED_NAMES = new Set(["script.run", "procedural.define", "behavior.attach"]);

const HINT = " Address entities by id (e_…) or { path }. Units: meters, Euler degrees XYZ.";

/**
 * Groups the `06` §3 union.
 *
 * @public
 */
export const TOOL_GROUPS: readonly ToolGroup[] = [
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

/**
 * True when a catalog entry must not become a tool (tier 4 until phase 7).
 *
 * @public
 */
export function shouldOmitTool(name: string, tier: number): boolean {
  if (tier >= 4) {
    return true;
  }
  return OMITTED_NAMES.has(name);
}

/**
 * Maps a command or query name to a tool group.
 *
 * @public
 */
export function groupForName(name: string, kind: "command" | "query" | "meta"): ToolGroup {
  if (kind === "meta") {
    return "meta";
  }
  if (kind === "query") {
    return "read";
  }
  const dot = name.indexOf(".");
  const head = dot === -1 ? name : name.slice(0, dot);
  if (head === "entity") {
    return "entities";
  }
  if (head === "component" || head === "transform" || head === "tags" || head === "metadata") {
    return "components";
  }
  if (head === "material") {
    return "materials";
  }
  if (head === "asset") {
    return "assets";
  }
  if (head === "layout") {
    return "layout";
  }
  if (head === "camera") {
    return "camera";
  }
  if (head === "environment" || head === "settings") {
    return "environment";
  }
  if (head === "script" || head === "procedural" || head === "behavior") {
    return "code";
  }
  return "generate";
}

/**
 * Imperative description plus addressing hints, capped at 400 characters.
 *
 * @public
 */
export function toolDescription(description: string): string {
  const base = description.trim();
  const withHint = `${base}${base.endsWith(".") ? "" : "."}${HINT}`;
  if (withHint.length <= 400) {
    return withHint;
  }
  return withHint.slice(0, 400);
}

function issueMessage(error: z.ZodError): string {
  const first = error.issues[0];
  if (first === undefined) {
    return "invalid tool input";
  }
  return first.message;
}

function isResult(value: unknown): value is Result<unknown, TesseraError> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("ok" in value)) {
    return false;
  }
  return value.ok === true || value.ok === false;
}

function runQuery(
  queries: QueryRegistry,
  name: string,
  input: unknown,
): Result<unknown, TesseraError> {
  const runner = Reflect.get(queries, "query");
  if (typeof runner !== "function") {
    return err(
      tesseraError(
        "UNSUPPORTED",
        "QueryRegistry cannot execute queries; pass QueryHost.query on the registry object (Q-0136).",
      ),
    );
  }
  const result: unknown = runner.call(queries, name, input);
  if (isResult(result)) {
    return result;
  }
  return err(tesseraError("INVARIANT_VIOLATION", "query runner returned a non-Result"));
}

function executeParsed<I, O>(
  group: ToolGroup,
  destructive: boolean,
  run: (input: I, ctx: ToolContext) => Result<O, TesseraError>,
  schema: z.ZodType<I>,
  input: unknown,
  ctx: ToolContext,
): Promise<Result<O, TesseraError>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return Promise.resolve(
        attachSuggestion(group, err(tesseraError("INVALID_INPUT", issueMessage(parsed.error)))),
      );
    }
    const blocked = denyIfDestructive(destructive, ctx.policy.confirmDestructive);
    if (!blocked.ok) {
      return Promise.resolve(err(blocked.error));
    }
    return Promise.resolve(attachSuggestion(group, run(parsed.data, ctx)));
  } catch {
    return Promise.resolve(err(tesseraError("INVARIANT_VIOLATION", "tool execution failed")));
  }
}

/**
 * Builds a command tool that runs `ctx.tx.run`.
 *
 * @public
 */
export function deriveCommandTool(command: CommandDefinition): ToolDefinition | undefined {
  if (shouldOmitTool(command.name, command.tier)) {
    return undefined;
  }
  const group = groupForName(command.name, "command");
  const destructive = isDestructiveCommand(command.name);
  const tier = command.tier;
  return {
    name: command.name,
    description: toolDescription(command.description),
    tier,
    group,
    input: command.input,
    output: command.output,
    destructive,
    execute: (input, ctx) =>
      executeParsed(
        group,
        destructive,
        (parsed) => ctx.tx.run(command.name, parsed),
        command.input,
        input,
        ctx,
      ),
  };
}

/**
 * Builds a query tool that never calls `tx.run` (`INV-AGT-05`).
 *
 * @public
 */
export function deriveQueryTool(query: QueryDefinition): ToolDefinition | undefined {
  if (shouldOmitTool(query.name, 0)) {
    return undefined;
  }
  const group = groupForName(query.name, "query");
  return {
    name: query.name,
    description: toolDescription(query.description),
    tier: 0,
    group,
    input: query.input,
    output: query.output,
    destructive: false,
    execute: (input, ctx) =>
      executeParsed(
        group,
        false,
        (parsed, inner) => runQuery(inner.queries, query.name, parsed),
        query.input,
        input,
        ctx,
      ),
  };
}
