import { expect, test } from "vitest";
import { defaultRunPolicy } from "./policy.js";
import type { RunEvent } from "./run-types.js";
import { buildRunTrace } from "./trace.js";
import type { CapabilityProfile } from "./types.js";

const profile: CapabilityProfile = {
  ref: { providerId: "openai", modelId: "m" },
  tools: "native",
  parallelTools: false,
  vision: false,
  structuredOutput: false,
  streaming: false,
  contextTokens: 32_000,
  maxOutputTokens: 4_000,
  maxTools: 64,
  needsExamples: false,
};

test("INV-OBS-03 run trace root run and step per model call", () => {
  const events: RunEvent[] = [
    {
      type: "run.started",
      runId: "r_testrun001",
      models: { planner: profile.ref, executor: profile.ref, critic: profile.ref },
      profile,
    },
    { type: "step.started", stepIndex: 0, role: "executor" },
    { type: "step.started", stepIndex: 1, role: "executor" },
    {
      type: "run.completed",
      report: {
        summary: "done",
        transactions: [],
        changeSet: {
          entities: { created: [], deleted: [], updated: [] },
          assets: { created: [], deleted: [], updated: [] },
          behaviors: { created: [], deleted: [], updated: [] },
          summary: "",
        },
        verification: { spatial: null, vision: null },
        remainingIssues: [],
        suggestions: [],
      },
      usage: { inputTokens: 10, outputTokens: 4 },
    },
  ];
  const trace = buildRunTrace({
    events,
    conversationId: "c_1",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:00:01.000Z",
    policy: defaultRunPolicy(profile, false),
    fallbackProfile: profile,
  });
  expect(trace.spans.filter((span) => span.name === "run")).toHaveLength(1);
  expect(trace.spans.filter((span) => span.name === "step")).toHaveLength(2);
  expect(trace.spans[0]?.parentId).toBeUndefined();
  expect(trace.outcome).toBe("completed");
  expect(trace.runId).toBe("r_testrun001");
});
