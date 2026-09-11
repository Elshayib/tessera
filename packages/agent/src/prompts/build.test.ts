import { expect, test } from "vitest";
import type { CapabilityProfile } from "../types.js";
import { buildSystemPrompt, describeMaxChars } from "./build.js";

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
