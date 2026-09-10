import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger, createMemorySink, isOk, ok } from "@tessera/std";
import { FakeClock } from "@tessera/testing";
import { expect, test } from "vitest";
import { createOllamaClient } from "./create-ollama-client.js";
import type { LlmClientDeps } from "./llm-client-deps.js";

test("Ollama listModels uses /api/tags and default 11434/v1", async () => {
  const fixture = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../fixtures/ollama-tags.json"),
    "utf8",
  );
  const urls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    urls.push(String(input));
    return new Response(fixture, { status: 200, headers: { "content-type": "application/json" } });
  };
  const deps: LlmClientDeps = {
    vault: {
      locked: false,
      get: async () => ok("unused"),
      set: async () => ok(undefined),
      delete: async () => ok(undefined),
      list: async () => ok([]),
      unlock: async () => ok(undefined),
    },
    logger: createLogger([createMemorySink().write]),
    clock: new FakeClock(),
    fetch: fetchImpl,
  };
  const client = createOllamaClient({ providerId: "ollama" }, deps);
  expect(client.provider.baseUrl.default).toBe("http://localhost:11434/v1");
  const listed = await client.listModels();
  expect(isOk(listed)).toBe(true);
  if (!listed.ok) {
    return;
  }
  expect(listed.value[0]?.ref.modelId).toBe("llama3.2");
  expect(urls.some((url) => url.includes("/api/tags"))).toBe(true);
  expect(urls.some((url) => url.startsWith("http://localhost:11434/api/tags"))).toBe(true);
  const empty = await createOllamaClient(
    { providerId: "ollama" },
    {
      ...deps,
      fetch: async () => new Response("{}", { status: 200 }),
    },
  ).listModels();
  expect(isOk(empty)).toBe(true);
});
