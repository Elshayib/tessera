import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { userText } from "@tessera/llm";
import { createLogger, createMemorySink, isOk, ok } from "@tessera/std";
import { FakeClock } from "@tessera/testing";
import { expect, test } from "vitest";
import { createGoogleClient } from "./create-google-client.js";
import { createOpenAIClient } from "./create-openai-client.js";
import { createOpenRouterClient } from "./create-openrouter-client.js";
import type { LlmClientDeps } from "./llm-client-deps.js";

function vaultDeps(fetchImpl: typeof fetch): LlmClientDeps {
  return {
    vault: {
      locked: false,
      get: async () => ok("sk-test"),
      set: async () => ok(undefined),
      delete: async () => ok(undefined),
      list: async () => ok([]),
      unlock: async () => ok(undefined),
    },
    logger: createLogger([createMemorySink().write]),
    clock: new FakeClock(),
    fetch: fetchImpl,
  };
}

test("OpenAI listModels uses recorded fixture", async () => {
  const body = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../fixtures/openai-models.json"),
    "utf8",
  );
  const fetchImpl: typeof fetch = async () =>
    new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  const listed = await createOpenAIClient(
    { providerId: "openai", apiKeyRef: "k" },
    vaultDeps(fetchImpl),
  ).listModels();
  expect(isOk(listed)).toBe(true);
  if (!listed.ok) {
    return;
  }
  expect(listed.value[0]?.ref.modelId).toBe("gpt-test");
});

test("OpenRouter catalog fills pricing and context", async () => {
  const body = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../fixtures/openrouter-models.json"),
    "utf8",
  );
  const fetchImpl: typeof fetch = async () =>
    new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  const listed = await createOpenRouterClient(
    { providerId: "openrouter", apiKeyRef: "k" },
    vaultDeps(fetchImpl),
  ).listModels();
  expect(isOk(listed)).toBe(true);
  if (!listed.ok) {
    return;
  }
  expect(listed.value[0]?.contextTokens).toBe(128000);
  expect(listed.value[0]?.pricing?.inputPerMTokUsd).toBe(1);
});

test("Google listModels parses models names", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ models: [{ name: "models/gemini-test" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  const listed = await createGoogleClient(
    { providerId: "google", apiKeyRef: "k" },
    vaultDeps(fetchImpl),
  ).listModels();
  expect(isOk(listed)).toBe(true);
  if (!listed.ok) {
    return;
  }
  expect(listed.value[0]?.ref.modelId).toBe("gemini-test");
});

test("HTTP 500 listModels is retryable PROVIDER_ERROR", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return new Response("nope", { status: 500 });
  };
  const listed = await createOpenAIClient(
    { providerId: "openai", apiKeyRef: "k" },
    { ...vaultDeps(fetchImpl), sleep: async () => undefined },
  ).listModels();
  expect(listed.ok).toBe(false);
  expect(calls).toBe(3);
  if (listed.ok) {
    return;
  }
  expect(listed.error.code).toBe("PROVIDER_ERROR");
  expect(JSON.stringify(listed.error).includes("nope")).toBe(false);
});

test("testConnection uses listModels latency", async () => {
  const body = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../fixtures/openai-models.json"),
    "utf8",
  );
  const fetchImpl: typeof fetch = async () =>
    new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  const connected = await createOpenAIClient(
    { providerId: "openai", apiKeyRef: "k" },
    vaultDeps(fetchImpl),
  ).testConnection();
  expect(isOk(connected)).toBe(true);
});

test("listModels invalid json is PROVIDER_ERROR", async () => {
  const fetchImpl: typeof fetch = async () => new Response("not-json", { status: 200 });
  const listed = await createOpenAIClient(
    { providerId: "openai", apiKeyRef: "k" },
    vaultDeps(fetchImpl),
  ).listModels();
  expect(listed.ok).toBe(false);
});

test("providerId mismatch is INVALID_INPUT", async () => {
  const fetchImpl: typeof fetch = async () => new Response("{}", { status: 200 });
  const listed = await createOpenAIClient(
    { providerId: "anthropic", apiKeyRef: "k" },
    vaultDeps(fetchImpl),
  ).listModels();
  expect(listed.ok).toBe(false);
  if (listed.ok) {
    return;
  }
  expect(listed.error.code).toBe("INVALID_INPUT");
});

test("testConnection returns listModels errors", async () => {
  const fetchImpl: typeof fetch = async () => new Response("no", { status: 401 });
  const connected = await createOpenAIClient(
    { providerId: "openai", apiKeyRef: "k" },
    vaultDeps(fetchImpl),
  ).testConnection();
  expect(connected.ok).toBe(false);
});

test("malformed catalogs are empty or errors", async () => {
  const empty = await createOpenAIClient(
    { providerId: "openai", apiKeyRef: "k" },
    vaultDeps(async () => new Response("{}", { status: 200 })),
  ).listModels();
  expect(isOk(empty)).toBe(true);
  if (empty.ok) {
    expect(empty.value).toEqual([]);
  }
  const skipped = await createOpenAIClient(
    { providerId: "openai", apiKeyRef: "k" },
    vaultDeps(
      async () =>
        new Response(JSON.stringify({ data: [1, { id: 2 }, { id: "ok" }] }), { status: 200 }),
    ),
  ).listModels();
  expect(isOk(skipped)).toBe(true);
  const googleBad = await createGoogleClient(
    { providerId: "google", apiKeyRef: "k" },
    vaultDeps(
      async () => new Response(JSON.stringify({ models: [1, { name: 2 }] }), { status: 200 }),
    ),
  ).listModels();
  expect(isOk(googleBad)).toBe(true);
  const routerBad = await createOpenRouterClient(
    { providerId: "openrouter", apiKeyRef: "k" },
    vaultDeps(
      async () =>
        new Response(JSON.stringify({ data: [{}, { id: "x", pricing: { prompt: "x" } }] }), {
          status: 200,
        }),
    ),
  ).listModels();
  expect(isOk(routerBad)).toBe(true);
  const googleEmpty = await createGoogleClient(
    { providerId: "google", apiKeyRef: "k" },
    vaultDeps(async () => new Response("{}", { status: 200 })),
  ).listModels();
  expect(isOk(googleEmpty)).toBe(true);
  const routerEmpty = await createOpenRouterClient(
    { providerId: "openrouter", apiKeyRef: "k" },
    vaultDeps(async () => new Response("{}", { status: 200 })),
  ).listModels();
  expect(isOk(routerEmpty)).toBe(true);
});

test("generate without languageModel uses AI SDK and fetch", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new TypeError("network");
  };
  const deps = { ...vaultDeps(fetchImpl), sleep: async () => undefined };
  const request = {
    model: { providerId: "openai", modelId: "gpt-test" },
    messages: [userText("hi")],
  };
  const openai = await createOpenAIClient({ providerId: "openai", apiKeyRef: "k" }, deps).generate(
    request,
  );
  expect(openai.ok).toBe(false);
});
