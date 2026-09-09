import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ToolDefinition } from "../tools/types.js";
import type { CapabilityProfile } from "../types.js";

const PROMPT_DIR = fileURLToPath(new URL(".", import.meta.url));

/**
 * Outline `maxChars` = 8% of the context window, min 2 KB, max 24 KB (`06` §4).
 *
 * @public
 */
export function describeMaxChars(contextTokens: number): number {
  return Math.min(24_576, Math.max(2_048, Math.round(contextTokens * 0.08)));
}

/**
 * Assembles system prompt sections 1–6 (`06` §6).
 *
 * @example
 * ```ts
 * buildSystemPrompt({ profile, tools: [], jsonMode: false });
 * ```
 *
 * @public
 */
export function buildSystemPrompt(input: {
  readonly profile: CapabilityProfile;
  readonly tools: readonly ToolDefinition[];
  readonly jsonMode: boolean;
}): string {
  const sections = [
    readSection("01-identity.md"),
    readSection("02-conventions.md"),
    readSection("03-addressing.md"),
    readSection("04-working-method.md"),
    readSection("05-safety.md"),
    readSection("06-output.md"),
  ];
  if (input.jsonMode) {
    sections.push(readSection("json-mode.md"));
  }
  if (input.profile.needsExamples) {
    sections.push(readSection("examples.md"));
  }
  if (!input.profile.vision) {
    sections.push(
      "Capability note: you cannot see images; rely on spatial checks and scene.describe.",
    );
  }
  if (!input.profile.parallelTools) {
    sections.push("Request one tool call per step unless the user asks for a batch.");
  }
  const names = input.tools.map((tool) => tool.name).join(", ");
  sections.push(`Available tools: ${names}.`);
  return sections.join("\n\n");
}

function readSection(name: string): string {
  return readFileSync(join(PROMPT_DIR, name), "utf8").trim();
}
