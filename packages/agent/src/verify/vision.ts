import type { LlmClient, LlmResponse, ModelRef } from "@tessera/llm";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import type { SpatialCheckResult, Verdict } from "../run-types.js";

/**
 * Parses a critic `Verdict` from structured output or a fenced JSON block (`06` §8.2).
 *
 * @example
 * ```ts
 * parseVerdict("```json\\n{\\"pass\\":true,\\"score\\":5,\\"issues\\":[]}\\n```");
 * ```
 *
 * @public
 */
export function parseVerdict(raw: unknown): Result<Verdict, TesseraError> {
  const direct = asVerdict(raw);
  if (direct !== undefined) {
    return ok(direct);
  }
  if (typeof raw !== "string") {
    return err(tesseraError("INVALID_INPUT", "verdict is not JSON"));
  }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1] ?? raw;
  try {
    const parsed: unknown = JSON.parse(body.trim());
    const verdict = asVerdict(parsed);
    if (verdict === undefined) {
      return err(tesseraError("INVALID_INPUT", "verdict JSON is incomplete"));
    }
    return ok(verdict);
  } catch {
    return err(tesseraError("INVALID_INPUT", "verdict JSON parse failed"));
  }
}

/**
 * Runs the vision critic, retrying once on a parse failure (`06` §8.2).
 *
 * @public
 */
export async function reviewWithCritic(input: {
  readonly llm: LlmClient;
  readonly model: ModelRef;
  readonly structuredOutput: boolean;
  readonly prompt: string;
  readonly spatial: SpatialCheckResult;
  readonly screenshots: readonly unknown[];
}): Promise<Result<Verdict, TesseraError>> {
  let last: TesseraError | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const generated = await input.llm.generate({
      model: input.model,
      messages: [
        {
          role: "user",
          parts: [
            {
              kind: "text",
              text: `User request:\n${input.prompt}\nSpatial:\n${JSON.stringify(input.spatial)}\nScreenshots: ${String(input.screenshots.length)}`,
            },
          ],
        },
      ],
      temperature: 0,
      ...(input.structuredOutput
        ? {
            responseFormat: {
              kind: "json_schema" as const,
              name: "Verdict",
              schema: { type: "object" },
            },
          }
        : {}),
    });
    if (!generated.ok) {
      last = tesseraError(generated.error.code, generated.error.message);
      continue;
    }
    const parsed = parseVerdict(verdictPayload(generated.value));
    if (parsed.ok) {
      return parsed;
    }
    last = parsed.error;
  }
  return err(last ?? tesseraError("INVALID_INPUT", "critic verdict parse failed"));
}

function verdictPayload(response: LlmResponse): unknown {
  if (response.message.role !== "assistant") {
    return "";
  }
  return response.message.parts
    .filter((part) => part.kind === "text")
    .map((part) => part.text)
    .join("");
}

function asVerdict(value: unknown): Verdict | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  if (!("pass" in value) || !("score" in value) || !("issues" in value)) {
    return undefined;
  }
  if (typeof value.pass !== "boolean") {
    return undefined;
  }
  const score = value.score;
  if (score !== 1 && score !== 2 && score !== 3 && score !== 4 && score !== 5) {
    return undefined;
  }
  if (!Array.isArray(value.issues)) {
    return undefined;
  }
  const issues: { entity?: string; problem: string; suggestion: string }[] = [];
  for (const item of value.issues) {
    if (typeof item !== "object" || item === null) {
      return undefined;
    }
    if (!("problem" in item) || !("suggestion" in item)) {
      return undefined;
    }
    if (typeof item.problem !== "string" || typeof item.suggestion !== "string") {
      return undefined;
    }
    const entity = "entity" in item && typeof item.entity === "string" ? item.entity : undefined;
    issues.push(
      entity === undefined
        ? { problem: item.problem, suggestion: item.suggestion }
        : { entity, problem: item.problem, suggestion: item.suggestion },
    );
  }
  return { pass: value.pass, score, issues };
}
