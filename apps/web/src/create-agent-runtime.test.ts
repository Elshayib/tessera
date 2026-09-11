import { userText } from "@tessera/llm";
import { FakeLlmClient } from "@tessera/testing";
import { createMemoryKeyVault } from "@tessera/ui";
import { expect, test } from "vitest";
import { bootstrap } from "./bootstrap.js";
import { createWebAgentRuntime, createWebLlmClient } from "./create-agent-runtime.js";

test("createWebAgentRuntime requires executor modelId", async () => {
  const ctx = bootstrap();
  const created = await createWebAgentRuntime({
    bus: ctx.commands,
    queries: ctx.queries,
    jobs: ctx.jobs,
    logger: ctx.logger,
    clock: ctx.clock,
    vault: ctx.keyVault,
    executor: { providerId: "openai", modelId: "" },
    transcripts: ctx.transcripts,
  });
  expect(created.ok).toBe(false);
});

test("createWebAgentRuntime runs with an injected LlmClient", async () => {
  const ctx = bootstrap();
  const llm = FakeLlmClient.script([{ respond: { text: "ok" } }]);
  const created = await createWebAgentRuntime({
    bus: ctx.commands,
    queries: ctx.queries,
    jobs: ctx.jobs,
    logger: ctx.logger,
    clock: ctx.clock,
    vault: createMemoryKeyVault(),
    executor: { providerId: "openai", modelId: "gpt-4o" },
    llm,
    transcripts: ctx.transcripts,
  });
  expect(created.ok).toBe(true);
  if (!created.ok) {
    return;
  }
  const events = [];
  for await (const event of created.value.run({
    conversationId: "c_editor",
    prompt: "Describe the scene.",
    context: { selection: [] },
    policy: { verify: "none", maxSteps: 2 },
  })) {
    events.push(event);
  }
  expect(events.some((event) => event.type === "run.completed")).toBe(true);
});

test("createWebAgentRuntime streams prior transcript turns", async () => {
  const ctx = bootstrap();
  const stored = await ctx.transcripts.append("c_editor", [
    {
      id: "e_prior",
      conversationId: "c_editor",
      projectId: "p_local00000",
      message: userText("earlier turn about the red cube"),
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  expect(stored.ok).toBe(true);
  const llm = FakeLlmClient.script([{ respond: { text: "ok" } }]);
  const created = await createWebAgentRuntime({
    bus: ctx.commands,
    queries: ctx.queries,
    jobs: ctx.jobs,
    logger: ctx.logger,
    clock: ctx.clock,
    vault: createMemoryKeyVault(),
    executor: { providerId: "openai", modelId: "gpt-4o" },
    llm,
    transcripts: ctx.transcripts,
  });
  expect(created.ok).toBe(true);
  if (!created.ok) {
    return;
  }
  for await (const event of created.value.run({
    conversationId: "c_editor",
    prompt: "what color was it?",
    context: { selection: [] },
    policy: { verify: "none", maxSteps: 2 },
  })) {
    void event;
  }
  const serialized = JSON.stringify(llm.requests[0]?.messages ?? []);
  expect(serialized).toContain("earlier turn about the red cube");
  expect(serialized).toContain("what color was it?");
});

test("createWebAgentRuntime rejects unknown provider when no llm is injected", async () => {
  const ctx = bootstrap();
  const created = await createWebAgentRuntime({
    bus: ctx.commands,
    queries: ctx.queries,
    jobs: ctx.jobs,
    logger: ctx.logger,
    clock: ctx.clock,
    vault: ctx.keyVault,
    executor: { providerId: "not-a-provider", modelId: "x" },
    transcripts: ctx.transcripts,
  });
  expect(created.ok).toBe(false);
});

test("createWebLlmClient rejects unknown provider", async () => {
  const ctx = bootstrap();
  const created = await createWebLlmClient({
    vault: ctx.keyVault,
    logger: ctx.logger,
    clock: ctx.clock,
    providerId: "not-a-provider",
  });
  expect(created.ok).toBe(false);
});
