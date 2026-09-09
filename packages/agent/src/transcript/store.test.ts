import type { LlmMessage } from "@tessera/llm";
import { userText } from "@tessera/llm";
import { expect, test } from "vitest";
import { defaultRunPolicy } from "../policy.js";
import type { RunEvent } from "../run-types.js";
import { buildRunTrace } from "../trace.js";
import type { CapabilityProfile } from "../types.js";
import { createMemoryTranscriptStore } from "./memory.js";
import type { TranscriptEntry } from "./store.js";

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

function entry(id: string, conversationId: string, message: LlmMessage): TranscriptEntry {
  return {
    id,
    conversationId,
    projectId: "p_1",
    message,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

test("recent respects tokenBudget", async () => {
  const store = createMemoryTranscriptStore();
  const huge = "x".repeat(4000);
  const appended = await store.append("c_1", [
    entry("e1", "c_1", userText(huge)),
    entry("e2", "c_1", userText("keep")),
  ]);
  expect(appended.ok).toBe(true);
  const recent = await store.recent("c_1", 20);
  expect(recent.ok).toBe(true);
  if (!recent.ok) {
    return;
  }
  expect(recent.value.length).toBe(1);
  expect(recent.value[0]).toEqual(userText("keep"));
});

test("INV-OBS-01 exportRun does not fetch", async () => {
  const store = createMemoryTranscriptStore();
  const events: RunEvent[] = [
    {
      type: "run.started",
      runId: "r_testrun001",
      models: { planner: profile.ref, executor: profile.ref, critic: profile.ref },
      profile,
    },
    { type: "step.started", stepIndex: 0, role: "executor" },
    { type: "run.completed", report: emptyReport(), usage: { inputTokens: 1, outputTokens: 1 } },
  ];
  const trace = buildRunTrace({
    events,
    conversationId: "c_1",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:00:01.000Z",
    policy: defaultRunPolicy(profile, false),
    fallbackProfile: profile,
  });
  await store.recordTrace(trace);
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response();
  };
  const exported = await store.exportRun("r_testrun001");
  globalThis.fetch = previous;
  expect(exported.ok).toBe(true);
  expect(calls).toBe(0);
});

test("exportRun redacts secrets and strips attachments", async () => {
  const store = createMemoryTranscriptStore();
  const events: RunEvent[] = [
    {
      type: "run.started",
      runId: "r_testrun001",
      models: { planner: profile.ref, executor: profile.ref, critic: profile.ref },
      profile,
    },
    { type: "run.completed", report: emptyReport(), usage: { inputTokens: 0, outputTokens: 0 } },
  ];
  const base = buildRunTrace({
    events,
    conversationId: "c_1",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:00:01.000Z",
    policy: defaultRunPolicy(profile, false),
    fallbackProfile: profile,
  });
  const root = base.spans[0];
  if (root === undefined) {
    return;
  }
  const withSecrets = {
    ...base,
    spans: [
      {
        ...root,
        attributes: {
          apiKey: "sk-secret",
          attachment: "data:image/png;base64,abc",
          runId: "r_testrun001",
        },
      },
    ],
  };
  await store.recordTrace(withSecrets);
  const stripped = await store.exportRun("r_testrun001");
  expect(stripped.ok).toBe(true);
  if (!stripped.ok) {
    return;
  }
  const attrs = stripped.value.spans[0]?.attributes;
  expect(attrs?.apiKey).toBe("[redacted]");
  expect(attrs?.attachment).toBeUndefined();
  const kept = await store.exportRun("r_testrun001", { includeAttachments: true });
  expect(kept.ok).toBe(true);
  if (!kept.ok) {
    return;
  }
  expect(kept.value.spans[0]?.attributes.attachment).toBe("data:image/png;base64,abc");
  expect(kept.value.spans[0]?.attributes.apiKey).toBe("[redacted]");
});

test("agent sources do not import react or ai", () => {
  const sources = import.meta.glob("../**/*.ts", {
    eager: true,
    query: "?raw",
    import: "default",
  });
  for (const [path, source] of Object.entries(sources)) {
    if (path.includes(".test.")) {
      continue;
    }
    expect(typeof source).toBe("string");
    if (typeof source !== "string") {
      continue;
    }
    expect(source.includes('from "react"'), path).toBe(false);
    expect(source.includes('from "ai"'), path).toBe(false);
    expect(source.includes("@tessera/providers-llm"), path).toBe(false);
  }
});

function emptyReport() {
  return {
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
  };
}
