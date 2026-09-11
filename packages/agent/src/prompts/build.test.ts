import { expect, test } from "vitest";
import type { CapabilityProfile } from "../types.js";
import { buildSystemPrompt, describeMaxChars } from "./build.js";
import { PROMPT_SECTIONS } from "./sections.js";

const profile: CapabilityProfile = {
  ref: { providerId: "test", modelId: "m" },
  tools: "native",
  parallelTools: true,
  vision: false,
  structuredOutput: false,
  streaming: true,
  contextTokens: 32_000,
  maxTools: 64,
  needsExamples: false,
  maxOutputTokens: 4_000,
};

test("prompt snapshots", async () => {
  const prompt = buildSystemPrompt({ profile, tools: [], jsonMode: false });
  await expect(prompt).toMatchFileSnapshot("./system-prompt.md");
  expect(describeMaxChars(32_000)).toBe(2_560);
  expect(describeMaxChars(8_000)).toBe(2_048);
  expect(describeMaxChars(1_000_000)).toBe(24_576);
});

test("prompt sections are inlined without node:fs", () => {
  expect(PROMPT_SECTIONS["01-identity.md"].includes("tools")).toBe(true);
  expect(PROMPT_SECTIONS["json-mode.md"].includes("tool")).toBe(true);
});
