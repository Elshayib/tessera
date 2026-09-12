import {
  createCommandBus,
  createDocument,
  createJobQueue,
  createQueryHost,
  createUndoService,
} from "@tessera/core";
import type { LlmClient, LlmRequest, LlmResponse, ToolCallPart } from "@tessera/llm";
import { emptyDocument } from "@tessera/schema";
import { createLogger, ok } from "@tessera/std";
import { FakeClock } from "@tessera/testing";
import { expect, test } from "vitest";
import type { RunEvent } from "./run-types.js";
import { createAgentRuntime } from "./runtime.js";
import { createToolRegistry } from "./tools/registry.js";
import type { CapabilityProfile } from "./types.js";

const executor = { providerId: "script", modelId: "exec" };
const profile: CapabilityProfile = {
  ref: executor,
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

test("finished job injects job.updated into the next step", async () => {
  const clock = new FakeClock();
  const created = createDocument({ snapshot: emptyDocument(), clock });
  const undo = createUndoService(created.doc);
  const bus = createCommandBus(created.doc, { undo: undo.capture });
  const host = createQueryHost(created.doc, { history: () => undo.committed() });
  const queries = Object.assign(host.registry, { query: host.query.bind(host) });
  const jobs = createJobQueue(bus, { logger: created.doc.logger });
  const tools = createToolRegistry();
  tools.deriveFromRegistries(bus.registry, queries);
  tools.register({
    name: "jobs.start",
    description: "start",
    tier: 3,
    group: "assets",
    input: { safeParse: (value: unknown) => ({ success: true as const, data: value }) },
    output: { safeParse: (value: unknown) => ({ success: true as const, data: value }) },
    destructive: false,
    async execute(_input, ctx) {
      const handle = ctx.jobs.enqueue({
        kind: "generate",
        label: "barrel",
        author: ctx.author,
        async run() {
          return ok({ done: true });
        },
      });
      return ok({ jobId: handle.id, etaSeconds: 1 });
    },
  });
  const captured: LlmRequest[] = [];
  let index = 0;
  const llm: LlmClient = {
    provider: {
      id: "script",
      displayName: "script",
      auth: "none",
      baseUrl: { configurable: false },
      browserDirect: "no",
      listsModels: false,
      docsUrl: "https://example.invalid",
    },
    listModels: async () => ok([]),
    testConnection: async () => ok({ latencyMs: 1 }),
    async generate(request) {
      captured.push(request);
      const script: LlmResponse[] = [
        {
          message: {
            role: "assistant",
            parts: [
              {
                kind: "toolCall",
                callId: "c1",
                name: "jobs.start",
                input: {},
              } satisfies ToolCallPart,
            ],
          },
          usage: { inputTokens: 1, outputTokens: 1 },
          finishReason: "tool_calls",
          modelId: "exec",
        },
        {
          message: { role: "assistant", parts: [{ kind: "text", text: "placed" }] },
          usage: { inputTokens: 1, outputTokens: 1 },
          finishReason: "stop",
          modelId: "exec",
        },
      ];
      const response = script[index];
      index += 1;
      if (response === undefined) {
        return { ok: false, error: { code: "PROVIDER_ERROR", message: "exhausted" } };
      }
      return ok(response);
    },
    async *stream(request) {
      const generated = await this.generate(request);
      if (!generated.ok) {
        return;
      }
      yield { type: "done" as const, response: generated.value };
    },
  };
  const runtime = createAgentRuntime({
    bus,
    queries,
    jobs,
    tools,
    llm,
    roles: { models: { planner: executor, executor }, criticEnabled: false },
    profiles: { "script:exec": profile },
    logger: createLogger([]),
    clock,
  });
  const events: RunEvent[] = [];
  for await (const event of runtime.run({
    conversationId: "c1",
    prompt: "generate",
    context: { selection: [] },
  })) {
    events.push(event);
  }
  const second = captured[1];
  const blob = JSON.stringify(second?.messages ?? []);
  expect(blob.includes("job.updated")).toBe(true);
});
