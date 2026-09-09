import "fake-indexeddb/auto";
import { userText } from "@tessera/llm";
import { expect, test } from "vitest";
import { defaultRunPolicy } from "../policy.js";
import { buildRunTrace } from "../trace.js";
import type { CapabilityProfile } from "../types.js";
import { createIndexedDbTranscriptStore } from "./idb.js";

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

test("indexeddb transcript store round-trips entries and traces", async () => {
  const created = await createIndexedDbTranscriptStore();
  expect(created.ok).toBe(true);
  if (!created.ok) {
    return;
  }
  const store = created.value;
  const appended = await store.append("c_1", [
    {
      id: "e1",
      conversationId: "c_1",
      projectId: "p_1",
      message: userText("hello"),
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  expect(appended.ok).toBe(true);
  const listed = await store.listConversations("p_1");
  expect(listed.ok).toBe(true);
  if (!listed.ok) {
    return;
  }
  expect(listed.value[0]?.conversationId).toBe("c_1");
  const trace = buildRunTrace({
    events: [
      {
        type: "run.started",
        runId: "r_testrun001",
        models: { planner: profile.ref, executor: profile.ref, critic: profile.ref },
        profile,
      },
      {
        type: "run.completed",
        report: {
          summary: "ok",
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
        usage: { inputTokens: 0, outputTokens: 0 },
      },
    ],
    conversationId: "c_1",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:00:01.000Z",
    policy: defaultRunPolicy(profile, false),
    fallbackProfile: profile,
  });
  await store.recordTrace(trace);
  const exported = await store.exportRun("r_testrun001");
  expect(exported.ok).toBe(true);
});
