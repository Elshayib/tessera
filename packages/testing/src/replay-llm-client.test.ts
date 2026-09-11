import { userImage, userText } from "@tessera/llm";
import { expect, test } from "vitest";
import type { LlmRecording } from "./replay-llm-client.js";
import { hashLlmRequest, ReplayLlmClient, stripVolatileFields } from "./replay-llm-client.js";

const MODEL = { providerId: "openai", modelId: "gpt-test" } as const;

const REQUEST = {
  model: MODEL,
  messages: [userText("hello")],
  tools: [{ name: "entity.create", description: "x", inputSchema: {} }],
};

test("ReplayLlmClient miss message mentions TESSERA_RECORD=1", async () => {
  const client = new ReplayLlmClient({ recordings: [] });
  const result = await client.generate(REQUEST);
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.error.message).toContain("no recording for request hash");
  expect(result.error.message).toContain("TESSERA_RECORD=1");
});

test("ReplayLlmClient hits a matching recording", async () => {
  const response = {
    message: { role: "assistant" as const, parts: [{ kind: "text" as const, text: "ok" }] },
    usage: { inputTokens: 2, outputTokens: 2 },
    finishReason: "stop" as const,
    modelId: MODEL.modelId,
  };
  const recording: LlmRecording = {
    requestHash: hashLlmRequest(REQUEST),
    request: {
      model: MODEL,
      systemPromptHash: "",
      messages: REQUEST.messages,
      toolNames: ["entity.create"],
    },
    response,
    usage: response.usage,
  };
  const client = new ReplayLlmClient({ recordings: [recording] });
  const hit = await client.generate(REQUEST);
  expect(hit.ok).toBe(true);
  if (!hit.ok) {
    return;
  }
  expect(hit.value.message).toEqual(response.message);
  const listed = await client.listModels();
  expect(listed.ok).toBe(true);
  const ping = await client.testConnection();
  expect(ping.ok).toBe(true);
  const events = [];
  for await (const event of client.stream(REQUEST)) {
    events.push(event.type);
  }
  expect(events).toEqual(["done"]);
});

test("ReplayLlmClient stream miss rejects with TESSERA_RECORD hint", async () => {
  const client = new ReplayLlmClient({ recordings: [] });
  await expect(
    (async () => {
      for await (const _event of client.stream(REQUEST)) {
        void _event;
      }
    })(),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("stripVolatileFields replaces timestamps and request ids", () => {
  expect(stripVolatileFields("at 2026-01-01T00:00:00.000Z id req_abc123")).toBe("at <ts> id <id>");
  expect(stripVolatileFields({ nested: ["req_x"] })).toEqual({ nested: ["<id>"] });
});

test("hashLlmRequest is stable for image parts", () => {
  const a = {
    model: MODEL,
    messages: [userImage("image/png", new Uint8Array([1, 2, 3]))],
  };
  const b = {
    model: MODEL,
    messages: [userImage("image/png", new Uint8Array([1, 2, 3]))],
  };
  expect(hashLlmRequest(a)).toBe(hashLlmRequest(b));
});
