import { userText } from "@tessera/llm";
import { createLogger, createMemorySink, ok } from "@tessera/std";
import { FakeClock } from "@tessera/testing";
import { MockLanguageModelV3 } from "ai/test";
import { expect, test } from "vitest";
import { createAnthropicClient } from "./create-anthropic-client.js";
import { createDeepSeekClient } from "./create-deepseek-client.js";
import { createGoogleClient } from "./create-google-client.js";
import { createOllamaClient } from "./create-ollama-client.js";
import { createOpenAICompatibleClient } from "./create-openai-compatible-client.js";
import { createOpenRouterClient } from "./create-openrouter-client.js";
import { createXaiClient } from "./create-xai-client.js";
import { PACKAGE_NAME } from "./index.js";

test("exports PACKAGE_NAME", () => {
  expect(PACKAGE_NAME).toBe("@tessera/providers-llm");
});

test("openai-compatible requires baseUrl", async () => {
  const client = createOpenAICompatibleClient(
    { providerId: "openai-compatible" },
    {
      vault: {
        locked: false,
        get: async () => ok("k"),
        set: async () => ok(undefined),
        delete: async () => ok(undefined),
        list: async () => ok([]),
        unlock: async () => ok(undefined),
      },
      logger: createLogger([createMemorySink().write]),
      clock: new FakeClock(),
    },
  );
  const result = await client.generate({
    model: { providerId: "openai-compatible", modelId: "local" },
    messages: [userText("hi")],
  });
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.error.code).toBe("INVALID_INPUT");
});

test("xai requires proxyUrl", async () => {
  const client = createXaiClient(
    { providerId: "xai", apiKeyRef: "k" },
    {
      vault: {
        locked: false,
        get: async () => ok("k"),
        set: async () => ok(undefined),
        delete: async () => ok(undefined),
        list: async () => ok([]),
        unlock: async () => ok(undefined),
      },
      logger: createLogger([createMemorySink().write]),
      clock: new FakeClock(),
      languageModel: new MockLanguageModelV3({
        doGenerate: {
          content: [{ type: "text", text: "x" }],
          finishReason: "stop",
          usage: { inputTokens: 1, outputTokens: 1 },
          warnings: [],
        },
      }),
    },
  );
  const result = await client.generate({
    model: { providerId: "xai", modelId: "grok" },
    messages: [userText("hi")],
  });
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.error.code).toBe("INVALID_INPUT");
});

test("google and openrouter descriptors", () => {
  const deps = {
    vault: {
      locked: false,
      get: async () => ok("k"),
      set: async () => ok(undefined),
      delete: async () => ok(undefined),
      list: async () => ok([]),
      unlock: async () => ok(undefined),
    },
    logger: createLogger([createMemorySink().write]),
    clock: new FakeClock(),
  };
  expect(
    createDeepSeekClient(
      { providerId: "deepseek", apiKeyRef: "k", proxyUrl: "http://127.0.0.1:9" },
      deps,
    ).provider.id,
  ).toBe("deepseek");
  expect(createGoogleClient({ providerId: "google", apiKeyRef: "k" }, deps).provider.id).toBe(
    "google",
  );
  expect(
    createOpenRouterClient({ providerId: "openrouter", apiKeyRef: "k" }, deps).provider.id,
  ).toBe("openrouter");
});

test("each adapter constructs an AI SDK model when generate runs", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new TypeError("network");
  };
  const deps = {
    vault: {
      locked: false,
      get: async () => ok("k"),
      set: async () => ok(undefined),
      delete: async () => ok(undefined),
      list: async () => ok([]),
      unlock: async () => ok(undefined),
    },
    logger: createLogger([createMemorySink().write]),
    clock: new FakeClock(),
    fetch: fetchImpl,
    sleep: async () => undefined,
  };
  const request = {
    model: { providerId: "openai", modelId: "m" },
    messages: [userText("hi")],
  };
  expect(
    (
      await createAnthropicClient({ providerId: "anthropic", apiKeyRef: "k" }, deps).generate(
        request,
      )
    ).ok,
  ).toBe(false);
  expect(
    (await createGoogleClient({ providerId: "google", apiKeyRef: "k" }, deps).generate(request)).ok,
  ).toBe(false);
  expect(
    (
      await createXaiClient(
        { providerId: "xai", apiKeyRef: "k", proxyUrl: "http://127.0.0.1:9" },
        deps,
      ).generate(request)
    ).ok,
  ).toBe(false);
  expect(
    (
      await createDeepSeekClient(
        { providerId: "deepseek", apiKeyRef: "k", proxyUrl: "http://127.0.0.1:9" },
        deps,
      ).generate(request)
    ).ok,
  ).toBe(false);
  expect(
    (
      await createOpenRouterClient({ providerId: "openrouter", apiKeyRef: "k" }, deps).generate(
        request,
      )
    ).ok,
  ).toBe(false);
  expect((await createOllamaClient({ providerId: "ollama" }, deps).generate(request)).ok).toBe(
    false,
  );
  expect(
    (
      await createOpenAICompatibleClient(
        { providerId: "openai-compatible", baseUrl: "http://127.0.0.1:9/v1", apiKeyRef: "k" },
        deps,
      ).generate(request)
    ).ok,
  ).toBe(false);
});
