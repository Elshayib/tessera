import { z } from "zod";
import { COMMAND_CATALOG, QUERY_CATALOG } from "./catalog.js";

const TO_JSON_SCHEMA = {
  io: "input",
  reused: "inline",
  unrepresentable: "any",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (!isRecord(value)) {
    return value;
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortValue(value[key]);
  }
  return sorted;
}

function schemaJson(schema: z.ZodType): unknown {
  return sortValue(z.toJSONSchema(schema, TO_JSON_SCHEMA));
}

export interface EmittedJsonSchema {
  readonly commands: Readonly<Record<string, unknown>>;
  readonly queries: Readonly<Record<string, unknown>>;
}

/**
 * JSON Schema for every catalog command and query. Deterministic key order.
 *
 * @example
 * ```ts
 * const schema = emitJsonSchema();
 * ```
 */
export function emitJsonSchema(): EmittedJsonSchema {
  const commands: Record<string, unknown> = {};
  for (const command of COMMAND_CATALOG) {
    commands[command.name] = sortValue({
      description: command.description,
      input: schemaJson(command.input),
      output: schemaJson(command.output),
      tags: [...command.tags],
      tier: command.tier,
    });
  }
  const queries: Record<string, unknown> = {};
  for (const query of QUERY_CATALOG) {
    queries[query.name] = sortValue({
      description: query.description,
      input: schemaJson(query.input),
      output: schemaJson(query.output),
      tags: [...query.tags],
    });
  }
  return { commands, queries };
}

/**
 * Pretty-print {@link emitJsonSchema} with a trailing newline.
 */
export function emitJsonSchemaText(): string {
  return `${JSON.stringify(emitJsonSchema(), null, 2)}\n`;
}
