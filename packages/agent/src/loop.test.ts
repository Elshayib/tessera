import { createAssetService } from "@tessera/assets";
import {
  createCommandBus,
  createDocument,
  createJobQueue,
  createQueryHost,
  createUndoService,
} from "@tessera/core";
import type { LlmClient, LlmRequest, LlmResponse, ToolCallPart } from "@tessera/llm";
import { userText } from "@tessera/llm";
import { canonicalize, emptyDocument } from "@tessera/schema";
import { abortError, createLogger, err, ok, tesseraError } from "@tessera/std";
import { docBuilder, FakeClock, MemoryBlobStore } from "@tessera/testing";
import { expect, test } from "vitest";
import type { RunEvent } from "./run-types.js";
import { createAgentRuntime } from "./runtime.js";
import { createToolRegistry } from "./tools/registry.js";
import { createTier3Tools } from "./tools/tier3.js";
import { createMemoryTranscriptStore } from "./transcript/memory.js";
import type { TranscriptStore } from "./transcript/store.js";
import type { CapabilityProfile } from "./types.js";

const authorUser = { kind: "user" as const, id: "tester" };
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

function scriptedClient(script: readonly LlmResponse[], captured?: LlmRequest[]): LlmClient {
  let index = 0;
  const provider = {
    id: "script",
    displayName: "script",
    auth: "none" as const,
    baseUrl: { configurable: false },
    browserDirect: "no" as const,
    listsModels: false,
    docsUrl: "https://example.invalid",
  };
  return {
    provider,
    listModels: async () => ok([]),
    testConnection: async () => ok({ latencyMs: 1 }),
    async generate(request: LlmRequest) {
      captured?.push(request);
      const response = script[index];
      index += 1;
      if (response === undefined) {
        return {
          ok: false as const,
          error: { code: "PROVIDER_ERROR" as const, message: "script exhausted" },
        };
      }
      return ok(response);
    },
    async *stream(request: LlmRequest) {
      const generated = await this.generate(request);
      if (!generated.ok) {
        throw generated.error;
      }
      const text =
        generated.value.message.role === "assistant"
          ? generated.value.message.parts
              .filter((part) => part.kind === "text")
              .map((part) => part.text)
              .join("")
          : "";
      if (text.length > 0) {
        yield { type: "text.delta" as const, text };
      }
      yield { type: "done" as const, response: generated.value };
    },
  };
}

function assistantCalls(
  calls: readonly ToolCallPart[],
  usage = { inputTokens: 10, outputTokens: 5 },
): LlmResponse {
  return {
    message: { role: "assistant", parts: [...calls] },
    usage,
    finishReason: "tool_calls",
    modelId: "exec",
  };
}

function assistantDone(text: string): LlmResponse {
  return {
    message: { role: "assistant", parts: [{ kind: "text", text }] },
    usage: { inputTokens: 4, outputTokens: 2 },
    finishReason: "stop",
    modelId: "exec",
  };
}

function harness(
  script: readonly LlmResponse[],
  clock = new FakeClock(),
  extra?: { readonly transcripts?: TranscriptStore; readonly captured?: LlmRequest[] },
) {
  const created = createDocument({ snapshot: emptyDocument(), clock });
  const undo = createUndoService(created.doc);
  const bus = createCommandBus(created.doc, { undo: undo.capture });
  const host = createQueryHost(created.doc, { history: () => undo.committed() });
  const queries = Object.assign(host.registry, { query: host.query.bind(host) });
  const jobs = createJobQueue(bus, { logger: created.doc.logger });
  const tools = createToolRegistry();
  tools.deriveFromRegistries(bus.registry, queries);
  const llm = scriptedClient(script, extra?.captured);
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
    newRunId: () => "r_testrun001",
    ...(extra?.transcripts === undefined ? {} : { transcripts: extra.transcripts }),
  });
  return { runtime, reader: created.reader, undo, bus };
}

async function collect(
  runtime: ReturnType<typeof createAgentRuntime>,
  extra?: { prompt?: string; confirmDestructive?: boolean; maxSteps?: number },
): Promise<readonly RunEvent[]> {
  const events: RunEvent[] = [];
  for await (const event of runtime.run({
    conversationId: "c1",
    prompt: extra?.prompt ?? "create a box",
    context: { selection: [] },
    policy: {
      verify: "none",
      confirmDestructive: extra?.confirmDestructive ?? false,
      maxSteps: extra?.maxSteps ?? 8,
      timeoutMs: 600_000,
    },
  })) {
    events.push(event);
  }
  return events;
}

test("loop offers tier-3 asset/generate/jobs tools when enabledTiers includes 3", async () => {
  const captured: LlmRequest[] = [];
  const created = createDocument({ snapshot: emptyDocument(), clock: new FakeClock() });
  const undo = createUndoService(created.doc);
  const bus = createCommandBus(created.doc, { undo: undo.capture });
  const host = createQueryHost(created.doc, { history: () => undo.committed() });
  const queries = Object.assign(host.registry, { query: host.query.bind(host) });
  const jobs = createJobQueue(bus, { logger: created.doc.logger });
  const tools = createToolRegistry();
  tools.deriveFromRegistries(bus.registry, queries);
  const assets = createAssetService({
    bus,
    jobs,
    blobs: new MemoryBlobStore(),
    clock: new FakeClock(),
  });
  for (const tool of createTier3Tools(assets)) {
    tools.register(tool);
  }
  const runtime = createAgentRuntime({
    bus,
    queries,
    jobs,
    tools,
    llm: scriptedClient([assistantDone("ok")], captured),
    roles: { models: { planner: executor, executor }, criticEnabled: false },
    profiles: { "script:exec": profile },
    logger: createLogger([]),
    clock: new FakeClock(),
    newRunId: () => "r_testrun001",
  });
  await collect(runtime, { maxSteps: 1 });
  const names = new Set((captured[0]?.tools ?? []).map((tool) => tool.name));
  expect(names.has("asset.search")).toBe(true);
  expect(names.has("asset.add")).toBe(true);
  expect(names.has("asset.generateMesh")).toBe(true);
  expect(names.has("asset.generateTexture")).toBe(true);
  expect(names.has("asset.generateEnvironment")).toBe(true);
  expect(names.has("asset.import")).toBe(true);
  expect(names.has("jobs.await")).toBe(true);
});

test("INV-AGT-01 mutations author.kind agent and runId", async () => {
  const { runtime, undo } = harness([
    assistantCalls([
      {
        kind: "toolCall",
        callId: "c1",
        name: "entity.create",
        input: { name: "box" },
      },
    ]),
    assistantDone("Created the box."),
  ]);
  const events = await collect(runtime);
  const committed = events.find((event) => event.type === "transaction.committed");
  expect(committed?.type).toBe("transaction.committed");
  if (committed?.type !== "transaction.committed") {
    return;
  }
  expect(committed.transaction.author.kind).toBe("agent");
  expect(committed.transaction.author.runId).toBe("r_testrun001");
  expect(undo.committed().some((record) => record.runId === "r_testrun001")).toBe(true);
});

test("INV-AGT-01 revertRun restores snapshot when no other author", async () => {
  const { runtime, reader, undo } = harness([
    assistantCalls([
      {
        kind: "toolCall",
        callId: "c1",
        name: "entity.create",
        input: { name: "box" },
      },
    ]),
    assistantDone("done"),
  ]);
  const before = canonicalize(reader.snapshot());
  await collect(runtime);
  expect(canonicalize(reader.snapshot())).not.toBe(before);
  expect(undo.undo.revertRun("r_testrun001").ok).toBe(true);
  expect(canonicalize(reader.snapshot())).toBe(before);
});

test("INV-AGT-04 completes failed or cancelled within timeout", async () => {
  const { runtime } = harness([
    assistantCalls([
      { kind: "toolCall", callId: "c1", name: "entity.create", input: { name: "a" } },
    ]),
    assistantCalls([
      { kind: "toolCall", callId: "c2", name: "entity.create", input: { name: "b" } },
    ]),
    assistantDone("more"),
  ]);
  const events: RunEvent[] = [];
  for await (const event of runtime.run({
    conversationId: "c1",
    prompt: "go",
    context: { selection: [] },
    policy: { verify: "none", maxSteps: 8 },
  })) {
    events.push(event);
    if (event.type === "run.started") {
      runtime.cancel(event.runId);
    }
  }
  const terminal = events[events.length - 1];
  expect(terminal?.type === "run.cancelled" || terminal?.type === "run.completed").toBe(true);
  expect(events.filter((event) => event.type.startsWith("run.")).length).toBeGreaterThanOrEqual(2);
});

test("INV-AGT-05 no mutating tool outside step transaction", async () => {
  const { runtime } = harness([
    assistantCalls([
      { kind: "toolCall", callId: "c1", name: "entity.create", input: { name: "box" } },
    ]),
    assistantDone("done"),
  ]);
  const events = await collect(runtime);
  const called = events.find((event) => event.type === "tool.called");
  const committed = events.find((event) => event.type === "transaction.committed");
  expect(called).toBeDefined();
  expect(committed).toBeDefined();
});

function geometryInput() {
  const built = docBuilder().entity("box", { mesh: "box" }).build();
  const asset = Object.values(built.assets)[0];
  expect(asset !== undefined).toBe(true);
  if (asset === undefined) {
    throw new Error("expected geometry");
  }
  const { id: _id, createdAt: _createdAt, ...input } = asset;
  void _id;
  void _createdAt;
  return input;
}

test("INV-AGT-06 confirmDestructive still enforced in loop", async () => {
  const created = createDocument({ snapshot: emptyDocument(), clock: new FakeClock() });
  const undo = createUndoService(created.doc);
  const bus = createCommandBus(created.doc, { undo: undo.capture });
  const host = createQueryHost(created.doc, { history: () => undo.committed() });
  const queries = Object.assign(host.registry, { query: host.query.bind(host) });
  const jobs = createJobQueue(bus, { logger: created.doc.logger });
  const tools = createToolRegistry();
  tools.deriveFromRegistries(bus.registry, queries);
  const asset = bus.execute("asset.create", { asset: geometryInput() }, { author: authorUser });
  expect(asset.ok).toBe(true);
  if (!asset.ok) {
    return;
  }
  const id = asset.value.output;
  const target = typeof id === "object" && id !== null && "id" in id ? id.id : undefined;
  expect(typeof target).toBe("string");
  if (typeof target !== "string") {
    return;
  }
  const runtime = createAgentRuntime({
    bus,
    queries,
    jobs,
    tools,
    llm: scriptedClient([
      assistantCalls([{ kind: "toolCall", callId: "d1", name: "asset.delete", input: { target } }]),
      assistantDone("blocked"),
    ]),
    roles: { models: { planner: executor, executor }, criticEnabled: false },
    profiles: { "script:exec": profile },
    logger: createLogger([]),
    clock: new FakeClock(),
    newRunId: () => "r_testrun001",
  });
  const events = await collect(runtime);
  const result = events.find((event) => event.type === "tool.result");
  expect(result?.type === "tool.result" && result.ok === false).toBe(true);
});

test("INV-AGT-08 identical script identical transactions", async () => {
  const script = [
    assistantCalls([
      { kind: "toolCall", callId: "c1", name: "entity.create", input: { name: "box" } },
    ]),
    assistantDone("done"),
  ];
  const fingerprint = async () => {
    const { runtime } = harness(script, new FakeClock());
    const events = await collect(runtime);
    return JSON.stringify(
      events
        .filter((event) => event.type === "transaction.committed")
        .map((event) => (event.type === "transaction.committed" ? event.transaction.commands : [])),
    );
  };
  expect(await fingerprint()).toBe(await fingerprint());
});

function waitForAbort(signal: AbortSignal | undefined): Promise<never> {
  return new Promise((_resolve, reject) => {
    const fail = (): void => {
      reject(abortError());
    };
    if (signal === undefined) {
      return;
    }
    if (signal.aborted) {
      fail();
      return;
    }
    signal.addEventListener("abort", fail, { once: true });
  });
}

function hangingHarness() {
  const created = createDocument({ snapshot: emptyDocument(), clock: new FakeClock() });
  const undo = createUndoService(created.doc);
  const bus = createCommandBus(created.doc, { undo: undo.capture });
  const host = createQueryHost(created.doc, { history: () => undo.committed() });
  const queries = Object.assign(host.registry, { query: host.query.bind(host) });
  const jobs = createJobQueue(bus, { logger: created.doc.logger });
  const tools = createToolRegistry();
  tools.deriveFromRegistries(bus.registry, queries);
  let lastStreamSignal: AbortSignal | undefined;
  let reportEntered: ((signal: AbortSignal | undefined) => void) | undefined;
  const enteredStream = new Promise<AbortSignal | undefined>((resolve) => {
    reportEntered = resolve;
  });
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
    generate: async () => ok(assistantDone("unused")),
    async *stream(_request: LlmRequest, signal?: AbortSignal) {
      lastStreamSignal = signal;
      reportEntered?.(signal);
      await waitForAbort(signal);
      yield { type: "done" as const, response: assistantDone("unused") };
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
    clock: new FakeClock(),
    newRunId: () => "r_testrun001",
  });
  return { runtime, lastSignal: () => lastStreamSignal, enteredStream };
}

test("INV-AGT-04 cancel aborts an in-flight stream", async () => {
  const { runtime, lastSignal, enteredStream } = hangingHarness();
  const events: RunEvent[] = [];
  const consuming = (async () => {
    for await (const event of runtime.run({
      conversationId: "c1",
      prompt: "go",
      context: { selection: [] },
      policy: { verify: "none", maxSteps: 8 },
    })) {
      events.push(event);
    }
  })();
  const streamSignal = await enteredStream;
  expect(streamSignal !== undefined).toBe(true);
  expect(lastSignal() !== undefined).toBe(true);
  runtime.cancel("r_testrun001");
  await consuming;
  expect(events[events.length - 1]?.type).toBe("run.cancelled");
});

test("INV-AGT-04 run signal aborts an in-flight stream", async () => {
  const { runtime, enteredStream } = hangingHarness();
  const controller = new AbortController();
  const events: RunEvent[] = [];
  const consuming = (async () => {
    for await (const event of runtime.run(
      {
        conversationId: "c1",
        prompt: "go",
        context: { selection: [] },
        policy: { verify: "none", maxSteps: 8 },
      },
      controller.signal,
    )) {
      events.push(event);
    }
  })();
  await enteredStream;
  controller.abort();
  await consuming;
  expect(events[events.length - 1]?.type).toBe("run.cancelled");
});

test("two consecutive empty steps remainingIssues", async () => {
  const { runtime } = harness([assistantDone(""), assistantDone(""), assistantDone("late")]);
  const events = await collect(runtime, { maxSteps: 8 });
  const done = events.find((event) => event.type === "run.completed");
  expect(done?.type).toBe("run.completed");
  if (done?.type !== "run.completed") {
    return;
  }
  expect(done.report.remainingIssues).toContain("model produced no actions");
});

test("run seeds messages from transcript.recent", async () => {
  const transcripts = createMemoryTranscriptStore();
  const stored = await transcripts.append("c1", [
    {
      id: "e_prior",
      conversationId: "c1",
      projectId: "p_local00000",
      message: userText("earlier turn about the red cube"),
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  expect(stored.ok).toBe(true);
  const captured: LlmRequest[] = [];
  const { runtime } = harness([assistantDone("Noted.")], new FakeClock(), {
    transcripts,
    captured,
  });
  const events = await collect(runtime, { prompt: "what color was it?" });
  expect(events.some((event) => event.type === "run.completed")).toBe(true);
  const serialized = JSON.stringify(captured[0]?.messages ?? []);
  expect(serialized).toContain("earlier turn about the red cube");
  expect(serialized).toContain("what color was it?");
});

test("run proceeds when transcript.recent fails", async () => {
  const transcripts: TranscriptStore = {
    async append() {
      return ok(undefined);
    },
    async recent() {
      return err(tesseraError("IO_ERROR", "transcripts unavailable"));
    },
    async listConversations() {
      return ok([]);
    },
    async recordTrace() {
      return ok(undefined);
    },
    async exportRun() {
      return err(tesseraError("NOT_FOUND", "no run"));
    },
  };
  const captured: LlmRequest[] = [];
  const { runtime } = harness([assistantDone("ok")], new FakeClock(), {
    transcripts,
    captured,
  });
  const events = await collect(runtime, { prompt: "hello" });
  expect(events.some((event) => event.type === "run.completed")).toBe(true);
  const serialized = JSON.stringify(captured[0]?.messages ?? []);
  expect(serialized).not.toContain("transcripts unavailable");
  expect(serialized).toContain("hello");
});
