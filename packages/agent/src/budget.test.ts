import { FakeClock } from "@tessera/testing";
import { expect, test } from "vitest";
import { createBudget } from "./budget.js";
import { defaultRunPolicy } from "./policy.js";
import type { CapabilityProfile } from "./types.js";

const profile: CapabilityProfile = {
  ref: { providerId: "test", modelId: "m" },
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

test("budget timeout fires after timeoutMs", () => {
  const clock = new FakeClock();
  const policy = { ...defaultRunPolicy(profile, false), timeoutMs: 10 };
  const budget = createBudget({ policy, clock, startedAtMs: clock.now() });
  clock.advance(11);
  const checked = budget.check();
  expect(checked.ok).toBe(false);
});
