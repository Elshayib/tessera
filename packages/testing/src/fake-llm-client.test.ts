import { assistantToolCalls, userText } from "@tessera/llm";
import { expect, test } from "vitest";
import { FakeLlmClient } from "./fake-llm-client.js";

const MODEL = { providerId: "fake", modelId: "fake-1" } as const;

test("FakeLlmClient script expectPromptIncludes then toolCalls", async () => {
  const call = {
    kind: "toolCall" as const,
    callId: "c1",
    name: "entity.create",
    input: { name: "cube" },
  };
  const client = FakeLlmClient.script([
    { expectPromptIncludes: "cube", respond: { toolCalls: [call] } },
  ]);
  const result = await client.generate({
    model: MODEL,
    messages: [userText("please add a cube")],
  });
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.value.finishReason).toBe("tool_calls");
  expect(result.value.message).toEqual(assistantToolCalls([call]));
  expect(client.requests).toHaveLength(1);
});

test("presets noTools noVision smallContext", () => {
  const noTools = new FakeLlmClient().preset("noTools");
  expect(noTools.capabilities.tools).toBe("none");
  const noVision = new FakeLlmClient().preset("noVision");
  expect(noVision.capabilities.vision).toBe(false);
  const small = new FakeLlmClient().preset("smallContext");
  expect(small.capabilities.contextTokens).toBeLessThan(32_000);
});

test("FakeLlmClient records mismatch and exhausted script", async () => {
  const client = FakeLlmClient.script([
    { expectPromptIncludes: "sphere", respond: { text: "ok" } },
  ]);
  const miss = await client.generate({ model: MODEL, messages: [userText("cube")] });
  expect(miss.ok).toBe(false);
  if (miss.ok) {
    return;
  }
  expect(miss.error.code).toBe("INVALID_INPUT");
  const exhausted = await client.generate({ model: MODEL, messages: [userText("sphere")] });
  expect(exhausted.ok).toBe(false);
});

test("FakeLlmClient stream text then done", async () => {
  const client = FakeLlmClient.script([{ respond: { text: "hello" } }]);
  const events = [];
  for await (const event of client.stream({ model: MODEL, messages: [userText("hi")] })) {
    events.push(event.type);
  }
  expect(events).toEqual(["text.delta", "done"]);
  const listed = await client.listModels();
  expect(listed.ok).toBe(true);
  const ping = await client.testConnection();
  expect(ping.ok).toBe(true);
});

test("FakeLlmClient stream rejects when the script is exhausted", async () => {
  const client = FakeLlmClient.script([]);
  await expect(
    (async () => {
      for await (const _event of client.stream({ model: MODEL, messages: [userText("x")] })) {
        void _event;
      }
    })(),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
});
