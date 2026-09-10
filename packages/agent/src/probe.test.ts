import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LlmClient, LlmRequest, LlmResponse, ModelDescriptor, ModelRef } from "@tessera/llm";
import { err, ok, tesseraError } from "@tessera/std";
import { FakeClock } from "@tessera/testing";
import { expect, test } from "vitest";
import { probeModel } from "./probe.js";
import { createProbeCache } from "./probe-cache.js";

const FORBIDDEN = [
  'from "ai"',
  'from "@ai-sdk',
  'from "@openrouter/',
  'from "three"',
  "providers-llm",
];

const REF: ModelRef = { providerId: "openai", modelId: "unknown-model" };

function emptyDescriptor(ref: ModelRef): ModelDescriptor {
  return { ref, displayName: ref.modelId, declared: {} };
}

function usage(): LlmResponse["usage"] {
  return { inputTokens: 1, outputTokens: 1 };
}

function textResponse(text: string): LlmResponse {
  return {
    message: { role: "assistant", parts: [{ kind: "text", text }] },
    usage: usage(),
    finishReason: "stop",
    modelId: REF.modelId,
  };
}

function toolResponse(name: string, input: unknown, count = 1): LlmResponse {
  const parts = Array.from({ length: count }, (_, index) => ({
    kind: "toolCall" as const,
    callId: `c${String(index)}`,
    name,
    input,
  }));
  return {
    message: { role: "assistant", parts },
    usage: usage(),
    finishReason: "tool_calls",
    modelId: REF.modelId,
  };
}

function scriptedClient(
  handler: (request: LlmRequest) => LlmResponse,
): LlmClient & { calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  const client: LlmClient & { calls: LlmRequest[] } = {
    calls,
    provider: {
      id: "openai",
      displayName: "OpenAI",
      auth: "apiKey",
      baseUrl: { configurable: true },
      browserDirect: "yes",
      listsModels: true,
      docsUrl: "https://example.invalid",
    },
    async listModels() {
      return ok([]);
    },
    async generate(request) {
      calls.push(request);
      return ok(handler(request));
    },
    async *stream() {
      yield { type: "done", response: textResponse("") };
    },
    async testConnection() {
      return ok({ latencyMs: 1 });
    },
  };
  return client;
}

test("INV-AGT-02 probe uses LlmClient only", () => {
  const srcRoot = dirname(fileURLToPath(import.meta.url));
  const walk = (dir: string): string[] => {
    const files: string[] = [];
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, name.name);
      if (name.isDirectory()) {
        files.push(...walk(path));
        continue;
      }
      if (!name.name.endsWith(".ts") || name.name.endsWith(".test.ts")) {
        continue;
      }
      files.push(path);
    }
    return files;
  };
  for (const file of walk(srcRoot)) {
    const source = readFileSync(file, "utf8");
    for (const needle of FORBIDDEN) {
      expect(source.includes(needle), file).toBe(false);
    }
  }
});

test("INV-PRV-04 unknown model is probed not assumed", async () => {
  const client = scriptedClient(() => toolResponse("echo", { value: "ok" }));
  const result = await probeModel({
    client,
    ref: REF,
    descriptor: emptyDescriptor(REF),
    cache: createProbeCache(),
    clock: new FakeClock(),
  });
  expect(result.ok).toBe(true);
  expect(client.calls.length).toBeGreaterThan(0);
  if (!result.ok) {
    return;
  }
  expect(result.value.tools).toBe("native");
  expect(result.value.needsExamples).toBe(false);
});

test("tools native vs json vs none", async () => {
  const native = scriptedClient(() => toolResponse("echo", { value: "ok" }));
  const nativeResult = await probeModel({
    client: native,
    ref: REF,
    descriptor: emptyDescriptor(REF),
    cache: createProbeCache(),
    clock: new FakeClock(),
  });
  expect(nativeResult.ok && nativeResult.value.tools === "native").toBe(true);

  const json = scriptedClient((request) => {
    if (request.tools !== undefined) {
      return textResponse("I cannot call tools");
    }
    return textResponse('{"name":"echo","input":{"value":"ok"}}');
  });
  const jsonResult = await probeModel({
    client: json,
    ref: REF,
    descriptor: emptyDescriptor(REF),
    cache: createProbeCache(),
    clock: new FakeClock(),
  });
  expect(jsonResult.ok && jsonResult.value.tools === "json").toBe(true);

  const none = scriptedClient(() => textResponse("hello"));
  const noneResult = await probeModel({
    client: none,
    ref: REF,
    descriptor: emptyDescriptor(REF),
    cache: createProbeCache(),
    clock: new FakeClock(),
  });
  expect(noneResult.ok && noneResult.value.tools === "none").toBe(true);
});

test("parallelTools vision structuredOutput", async () => {
  const client = scriptedClient((request) => {
    if (request.responseFormat !== undefined) {
      return textResponse('{"a":1,"b":2}');
    }
    if (
      request.messages.some(
        (message) => message.role === "user" && message.parts.some((part) => part.kind === "image"),
      )
    ) {
      return textResponse("red");
    }
    if (
      request.tools !== undefined &&
      request.messages.some((message) => JSON.stringify(message).includes("two"))
    ) {
      return toolResponse("echo", { value: "ok" }, 2);
    }
    return toolResponse("echo", { value: "ok" });
  });
  const result = await probeModel({
    client,
    ref: REF,
    descriptor: emptyDescriptor(REF),
    cache: createProbeCache(),
    clock: new FakeClock(),
  });
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.value.parallelTools).toBe(true);
  expect(result.value.vision).toBe(true);
  expect(result.value.structuredOutput).toBe(true);
  expect(client.calls.length).toBeLessThanOrEqual(4);
});

test("unknown descriptor uses 32k/4k", async () => {
  const client = scriptedClient(() => toolResponse("echo", { value: "ok" }));
  const result = await probeModel({
    client,
    ref: REF,
    descriptor: emptyDescriptor(REF),
    cache: createProbeCache(),
    clock: new FakeClock(),
  });
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.value.contextTokens).toBe(32_000);
  expect(result.value.maxOutputTokens).toBe(4_000);
  expect(result.value.maxTools).toBe(64);
});

test("descriptor limits and cache hit", async () => {
  const client = scriptedClient(() => toolResponse("echo", { value: "ok" }));
  const cache = createProbeCache();
  const clock = new FakeClock();
  const descriptor: ModelDescriptor = {
    ref: REF,
    displayName: "Unknown",
    contextTokens: 8_000,
    maxOutputTokens: 512,
    declared: { streaming: true, maxTools: 8 },
  };
  const first = await probeModel({ client, ref: REF, descriptor, cache, clock });
  expect(first.ok && first.value.contextTokens === 8_000).toBe(true);
  expect(first.ok && first.value.maxOutputTokens === 512).toBe(true);
  expect(first.ok && first.value.maxTools === 8).toBe(true);
  expect(first.ok && first.value.streaming === true).toBe(true);
  const callsAfterFirst = client.calls.length;
  const second = await probeModel({ client, ref: REF, descriptor, cache, clock });
  expect(second.ok).toBe(true);
  expect(client.calls.length).toBe(callsAfterFirst);
});

test("generate error and malformed json", async () => {
  const failing: LlmClient = {
    ...scriptedClient(() => textResponse("x")),
    async generate() {
      return err(tesseraError("PROVIDER_ERROR", "down"));
    },
  };
  const failed = await probeModel({
    client: failing,
    ref: REF,
    descriptor: emptyDescriptor(REF),
    cache: createProbeCache(),
    clock: new FakeClock(),
  });
  expect(failed.ok).toBe(false);

  const malformed = scriptedClient((request) => {
    if (request.tools !== undefined) {
      return textResponse("no tools");
    }
    return textResponse("{not-json");
  });
  const jsonNone = await probeModel({
    client: malformed,
    ref: REF,
    descriptor: emptyDescriptor(REF),
    cache: createProbeCache(),
    clock: new FakeClock(),
  });
  expect(jsonNone.ok && jsonNone.value.tools === "none").toBe(true);

  const pairJunk = scriptedClient((request) => {
    if (request.responseFormat !== undefined) {
      return textResponse("{");
    }
    if (
      request.messages.some(
        (message) => message.role === "user" && message.parts.some((part) => part.kind === "image"),
      )
    ) {
      return textResponse("blue");
    }
    return toolResponse("echo", { value: "ok" });
  });
  const pair = await probeModel({
    client: pairJunk,
    ref: REF,
    descriptor: emptyDescriptor(REF),
    cache: createProbeCache(),
    clock: new FakeClock(),
  });
  expect(pair.ok && pair.value.structuredOutput === false).toBe(true);
  expect(pair.ok && pair.value.vision === false).toBe(true);
});
