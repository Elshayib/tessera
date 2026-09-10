import { createLogger, createMemorySink, isOk, ok } from "@tessera/std";
import { FakeClock } from "@tessera/testing";
import { expect, test } from "vitest";
import { createAnthropicClient } from "./create-anthropic-client.js";
import { ANTHROPIC_BROWSER_HEADER } from "./descriptors.js";
import type { LlmClientDeps } from "./llm-client-deps.js";

test("Anthropic sets anthropic-dangerous-direct-browser-access", async () => {
  const seen: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    const value = headers.get(ANTHROPIC_BROWSER_HEADER);
    if (value !== null) {
      seen.push(value);
    }
    void input;
    return new Response(JSON.stringify({ data: [{ id: "claude-test" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const deps: LlmClientDeps = {
    vault: {
      locked: false,
      get: async () => ok("sk-ant"),
      set: async () => ok(undefined),
      delete: async () => ok(undefined),
      list: async () => ok([]),
      unlock: async () => ok(undefined),
    },
    logger: createLogger([createMemorySink().write]),
    clock: new FakeClock(),
    fetch: fetchImpl,
  };
  const client = createAnthropicClient({ providerId: "anthropic", apiKeyRef: "k" }, deps);
  const listed = await client.listModels();
  expect(isOk(listed)).toBe(true);
  expect(seen.includes("true")).toBe(true);
});

test("Anthropic descriptor browserDirect is header", () => {
  const client = createAnthropicClient(
    { providerId: "anthropic", apiKeyRef: "k" },
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
  expect(client.provider.browserDirect).toBe("header");
  expect(client.provider.id).toBe("anthropic");
});
