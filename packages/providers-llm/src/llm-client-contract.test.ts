import type { KeyVault } from "@tessera/llm";
import { assistantToolCalls, systemMessage, toolResultMessage, userText } from "@tessera/llm";
import type { TesseraError } from "@tessera/std";
import { createLogger, createMemorySink, isOk, ok } from "@tessera/std";
import { FakeClock } from "@tessera/testing";
import { APICallError } from "ai";
import { convertArrayToReadableStream, MockLanguageModelV3 } from "ai/test";
import { expect, test } from "vitest";
import { createOpenAIClient } from "./create-openai-client.js";
import type { LlmClientDeps } from "./llm-client-deps.js";

function memoryVault(secret: string, gets: { count: number }): KeyVault {
  return {
    locked: false,
    async get() {
      gets.count += 1;
      return ok(secret);
    },
    async set() {
      return ok(undefined);
    },
    async delete() {
      return ok(undefined);
    },
    async list() {
      return ok([]);
    },
    async unlock() {
      return ok(undefined);
    },
  };
}

function deps(languageModel: object): { deps: LlmClientDeps; gets: { count: number } } {
  const gets = { count: 0 };
  const clock = new FakeClock();
  return {
    gets,
    deps: {
      vault: memoryVault("sk-test", gets),
      logger: createLogger([createMemorySink().write]),
      clock,
      sleep: async () => undefined,
      languageModel,
    },
  };
}

const echoRequest = {
  model: { providerId: "openai", modelId: "gpt-test" },
  messages: [userText("Call echo with value ok.")],
  tools: [
    {
      name: "echo",
      description: "echo",
      inputSchema: { type: "object", properties: { value: { type: "string" } } },
    },
  ],
};

test("INV-PRV-02 generate calls KeyVault.get at request time", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: {
      content: [{ type: "text", text: "ok" }],
      finishReason: "stop",
      usage: { inputTokens: 1, outputTokens: 1 },
      warnings: [],
    },
  });
  const wired = deps(model);
  const client = createOpenAIClient({ providerId: "openai", apiKeyRef: "vault-ref" }, wired.deps);
  expect(wired.gets.count).toBe(0);
  const result = await client.generate(echoRequest);
  expect(wired.gets.count).toBe(1);
  expect(isOk(result)).toBe(true);
});

test("INV-PRV-03 raw vendor body is not on TesseraError", async () => {
  const secret = "sk-live-vendor-body";
  const model = new MockLanguageModelV3({
    doGenerate: async () => {
      throw new APICallError({
        message: "boom",
        url: "https://example.invalid",
        requestBodyValues: {},
        statusCode: 500,
        responseBody: secret,
      });
    },
  });
  const wired = deps(model);
  const result = await createOpenAIClient(
    { providerId: "openai", apiKeyRef: "vault-ref" },
    wired.deps,
  ).generate(echoRequest);
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  const error: TesseraError = result.error;
  expect(error.message.includes(secret)).toBe(false);
  expect(JSON.stringify(error).includes(secret)).toBe(false);
});

test("contract: tool call round-trip", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: {
      content: [
        {
          type: "tool-call",
          toolCallId: "c1",
          toolName: "echo",
          input: { value: "ok" },
        },
      ],
      finishReason: "tool-calls",
      usage: { inputTokens: 4, outputTokens: 2 },
      warnings: [],
    },
  });
  const wired = deps(model);
  const result = await createOpenAIClient(
    { providerId: "openai", apiKeyRef: "vault-ref" },
    wired.deps,
  ).generate(echoRequest);
  expect(isOk(result)).toBe(true);
  if (!result.ok) {
    return;
  }
  const call = result.value.message.parts.find((part) => part.kind === "toolCall");
  expect(call).toEqual({ kind: "toolCall", callId: "c1", name: "echo", input: { value: "ok" } });
});

test("contract: streaming ends with done", async () => {
  const model = new MockLanguageModelV3({
    doStream: {
      stream: convertArrayToReadableStream([
        { type: "stream-start", warnings: [] },
        { type: "text-start", id: "t" },
        { type: "text-delta", id: "t", delta: "hi" },
        { type: "text-end", id: "t" },
        {
          type: "finish",
          finishReason: { unified: "stop", raw: "stop" },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 1, text: 1, reasoning: 0 },
          },
        },
      ]),
    },
  });
  const wired = deps(model);
  const events = [];
  for await (const event of createOpenAIClient(
    { providerId: "openai", apiKeyRef: "vault-ref" },
    wired.deps,
  ).stream(echoRequest)) {
    events.push(event);
  }
  expect(events.some((event) => event.type === "text.delta")).toBe(true);
  const done = events.at(-1);
  expect(done?.type).toBe("done");
});

test("contract: abort → CANCELLED", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: {
      content: [{ type: "text", text: "nope" }],
      finishReason: "stop",
      usage: { inputTokens: 1, outputTokens: 1 },
      warnings: [],
    },
  });
  const wired = deps(model);
  const controller = new AbortController();
  controller.abort();
  const result = await createOpenAIClient(
    { providerId: "openai", apiKeyRef: "vault-ref" },
    wired.deps,
  ).generate(echoRequest, controller.signal);
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.error.code).toBe("CANCELLED");
});

test("contract: vision request is accepted", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: {
      content: [{ type: "text", text: "red" }],
      finishReason: "stop",
      usage: { inputTokens: 2, outputTokens: 1 },
      warnings: [],
    },
  });
  const wired = deps(model);
  const result = await createOpenAIClient(
    { providerId: "openai", apiKeyRef: "vault-ref" },
    wired.deps,
  ).generate({
    model: { providerId: "openai", modelId: "gpt-test" },
    messages: [
      {
        role: "user",
        parts: [
          { kind: "text", text: "color?" },
          { kind: "image", mime: "image/png", data: new Uint8Array([1, 2, 3]) },
        ],
      },
    ],
  });
  expect(isOk(result)).toBe(true);
});

test("contract: structured output request is accepted", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: {
      content: [{ type: "text", text: '{"a":1}' }],
      finishReason: "stop",
      usage: { inputTokens: 2, outputTokens: 1 },
      warnings: [],
    },
  });
  const wired = deps(model);
  const result = await createOpenAIClient(
    { providerId: "openai", apiKeyRef: "vault-ref" },
    wired.deps,
  ).generate({
    model: { providerId: "openai", modelId: "gpt-test" },
    messages: [userText("json")],
    responseFormat: {
      kind: "json_schema",
      name: "pair",
      schema: { type: "object", properties: { a: { type: "number" } } },
    },
  });
  expect(isOk(result)).toBe(true);
});

test("INV-PRV-03 429 generate retries then succeeds", async () => {
  let calls = 0;
  const model = new MockLanguageModelV3({
    doGenerate: async () => {
      calls += 1;
      if (calls < 3) {
        throw new APICallError({
          message: "rate",
          url: "https://example.invalid",
          requestBodyValues: {},
          statusCode: 429,
          responseHeaders: { "retry-after": "1" },
        });
      }
      return {
        content: [{ type: "text", text: "ok" }],
        finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1 },
        warnings: [],
      };
    },
  });
  const wired = deps(model);
  const result = await createOpenAIClient(
    { providerId: "openai", apiKeyRef: "vault-ref" },
    wired.deps,
  ).generate(echoRequest);
  expect(calls).toBe(3);
  expect(isOk(result)).toBe(true);
});

test("stream retries retryable failures", async () => {
  let calls = 0;
  const model = new MockLanguageModelV3({
    doStream: async () => {
      calls += 1;
      if (calls < 2) {
        throw new APICallError({
          message: "rate",
          url: "https://example.invalid",
          requestBodyValues: {},
          statusCode: 429,
        });
      }
      return {
        stream: convertArrayToReadableStream([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: "hi" },
          { type: "text-end", id: "t" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
              inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 1, text: 1, reasoning: 0 },
            },
          },
        ]),
      };
    },
  });
  const wired = deps(model);
  const events = [];
  for await (const event of createOpenAIClient(
    { providerId: "openai", apiKeyRef: "vault-ref" },
    wired.deps,
  ).stream(echoRequest)) {
    events.push(event);
  }
  expect(events.at(-1)?.type).toBe("done");
});

test("system messages use the AI SDK system option", async () => {
  let promptJson = "";
  const model = new MockLanguageModelV3({
    doGenerate: async ({ prompt }) => {
      promptJson = JSON.stringify(prompt);
      return {
        content: [{ type: "text", text: "ok" }],
        finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1 },
        warnings: [],
      };
    },
  });
  const wired = deps(model);
  const result = await createOpenAIClient(
    { providerId: "openai", apiKeyRef: "vault-ref" },
    wired.deps,
  ).generate({
    model: echoRequest.model,
    messages: [systemMessage("You are Tessera."), userText("Add a cube.")],
  });
  expect(isOk(result)).toBe(true);
  expect(promptJson.includes("You are Tessera.")).toBe(true);
});

test("stream with a system message ends with done", async () => {
  const model = new MockLanguageModelV3({
    doStream: {
      stream: convertArrayToReadableStream([
        { type: "stream-start", warnings: [] },
        { type: "text-start", id: "t" },
        { type: "text-delta", id: "t", delta: "ok" },
        { type: "text-end", id: "t" },
        {
          type: "finish",
          finishReason: { unified: "stop", raw: "stop" },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 1, text: 1, reasoning: 0 },
          },
        },
      ]),
    },
  });
  const wired = deps(model);
  const events = [];
  for await (const event of createOpenAIClient(
    { providerId: "openai", apiKeyRef: "vault-ref" },
    wired.deps,
  ).stream({
    model: echoRequest.model,
    messages: [systemMessage("You are Tessera."), userText("Add a cube.")],
    tools: echoRequest.tools,
  })) {
    events.push(event);
  }
  expect(events.at(-1)?.type).toBe("done");
});

test("tool results follow assistant tool calls in the provider prompt", async () => {
  let promptJson = "";
  const model = new MockLanguageModelV3({
    doGenerate: async ({ prompt }) => {
      promptJson = JSON.stringify(prompt);
      return {
        content: [{ type: "text", text: "ok" }],
        finishReason: "stop",
        usage: { inputTokens: 2, outputTokens: 1 },
        warnings: [],
      };
    },
  });
  const wired = deps(model);
  const result = await createOpenAIClient(
    { providerId: "openai", apiKeyRef: "vault-ref" },
    wired.deps,
  ).generate({
    model: echoRequest.model,
    tools: echoRequest.tools,
    messages: [
      userText("Call echo with value ok."),
      assistantToolCalls([
        { kind: "toolCall", callId: "c1", name: "echo", input: { value: "ok" } },
      ]),
      toolResultMessage([{ callId: "c1", name: "echo", result: { echoed: "ok" }, isError: false }]),
    ],
  });
  expect(isOk(result)).toBe(true);
  expect(promptJson.includes("c1")).toBe(true);
  expect(promptJson.includes("echoed")).toBe(true);
});

test("missing apiKeyRef is PERMISSION_DENIED", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: {
      content: [{ type: "text", text: "x" }],
      finishReason: "stop",
      usage: { inputTokens: 1, outputTokens: 1 },
      warnings: [],
    },
  });
  const wired = deps(model);
  const result = await createOpenAIClient({ providerId: "openai" }, wired.deps).generate(
    echoRequest,
  );
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.error.code).toBe("PERMISSION_DENIED");
});
