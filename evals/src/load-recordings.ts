import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ModelRef } from "@tessera/llm";
import { type LlmRecording, loadRecordingTexts } from "@tessera/testing";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asRecording(value: unknown): LlmRecording | undefined {
  if (!isLlmRecording(value)) {
    return undefined;
  }
  return value;
}

function isLlmRecording(value: unknown): value is LlmRecording {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value["requestHash"] === "string" &&
    isRecord(value["request"]) &&
    isRecord(value["response"]) &&
    isRecord(value["usage"])
  );
}

/**
 * Parses one case fixture: a single {@link LlmRecording} or an array (Q-0156).
 *
 * @example
 * ```ts
 * parseRecordingFile("evals/fixtures/recordings/openai/core/core.red-cube.gpt-4o.json");
 * ```
 *
 * @public
 */
export function parseRecordingFile(path: string): readonly LlmRecording[] {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (Array.isArray(parsed)) {
    return parsed.flatMap((item) => {
      const recording = asRecording(item);
      return recording === undefined ? [] : [recording];
    });
  }
  const recording = asRecording(parsed);
  return recording === undefined ? [] : [recording];
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_");
}

/**
 * Loads every JSON recording for one `providerId/modelId` pair.
 *
 * @example
 * ```ts
 * await loadRecordingsForModel(root, { providerId: "openai", modelId: "gpt-4o" });
 * ```
 *
 * @public
 */
export async function loadRecordingsForModel(
  root: string,
  model: ModelRef,
): Promise<readonly LlmRecording[]> {
  const files = await loadRecordingTexts(join(root, sanitizeSegment(model.providerId)));
  const suffix = `.${sanitizeSegment(model.modelId)}.json`;
  const out: LlmRecording[] = [];
  for (const file of files) {
    if (!file.path.endsWith(suffix)) {
      continue;
    }
    out.push(...parseRecordingFile(file.path));
  }
  return out;
}
