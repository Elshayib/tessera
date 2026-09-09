import type { ToolCallPart } from "@tessera/llm";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";

const FENCE = /```tool\s*([\s\S]*?)```/g;

/**
 * Parses JSON-mode tool fences (`06` §11).
 *
 * @example
 * ```ts
 * parseJsonModeTools('```tool\\n{"name":"scene.describe","input":{}}\\n```');
 * ```
 *
 * @public
 */
export function parseJsonModeTools(text: string): Result<readonly ToolCallPart[], TesseraError> {
  const calls: ToolCallPart[] = [];
  const matches = text.matchAll(FENCE);
  let index = 0;
  let found = false;
  for (const match of matches) {
    found = true;
    const body = match[1];
    if (body === undefined) {
      return err(tesseraError("INVALID_INPUT", "empty tool fence"));
    }
    const parsed = parseObject(body.trim(), index);
    index += 1;
    if (!parsed.ok) {
      return parsed;
    }
    calls.push(parsed.value);
  }
  if (!found) {
    return err(tesseraError("INVALID_INPUT", "no tool fence in JSON-mode output"));
  }
  return ok(calls);
}

function parseObject(body: string, index: number): Result<ToolCallPart, TesseraError> {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return err(tesseraError("INVALID_INPUT", "tool fence is not JSON"));
  }
  if (!isRecord(value)) {
    return err(tesseraError("INVALID_INPUT", "tool fence must be an object"));
  }
  const name = value["name"];
  if (typeof name !== "string" || name.length === 0) {
    return err(tesseraError("INVALID_INPUT", "tool fence missing name"));
  }
  const rawId = value["callId"];
  const callId = typeof rawId === "string" ? rawId : `json_${String(index)}`;
  return ok({
    kind: "toolCall",
    callId,
    name,
    input: value["input"] ?? {},
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
