import type { QueryRegistry, TransactionHandle } from "@tessera/core";
import type { LlmClient, LlmRequest } from "@tessera/llm";
import type { CheckSceneReader } from "@tessera/spatial";
import { err, ok, tesseraError } from "@tessera/std";
import { expect, test } from "vitest";
import type { RunPolicy } from "./tools/types.js";
import type { CapabilityProfile } from "./types.js";
import { createSceneVerifier, verificationFeedbackMessage } from "./verifier.js";

const policyVision: RunPolicy = {
  enabledTiers: [0, 1, 2],
  maxSteps: 8,
  maxToolCallsPerStep: 8,
  maxInputTokens: 400_000,
  timeoutMs: 60_000,
  verify: "spatial+vision",
  maxRepairRounds: 2,
  confirmDestructive: false,
  temperature: 0.2,
};

const dummyTx: TransactionHandle = {
  id: "t_verify000",
  run: () => err(tesseraError("UNSUPPORTED", "tx")),
};

const profileVision: CapabilityProfile = {
  ref: { providerId: "script", modelId: "critic" },
  tools: "native",
  parallelTools: false,
  vision: true,
  structuredOutput: true,
  streaming: true,
  contextTokens: 32_000,
  maxTools: 64,
  needsExamples: false,
  maxOutputTokens: 4_000,
};

function emptyReader(): CheckSceneReader {
  return {
    getEntity: () => undefined,
    getAsset: () => undefined,
    parentChain: () => [],
    pathOf: () => undefined,
    entities: () => [],
  };
}

test("spatial then vision order", async () => {
  const order: string[] = [];
  const reader: CheckSceneReader = {
    ...emptyReader(),
    entities() {
      order.push("spatial");
      return [];
    },
  };
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
    async generate(request: LlmRequest) {
      void request;
      order.push("vision");
      return ok({
        message: {
          role: "assistant",
          parts: [{ kind: "text", text: '{"pass":true,"score":5,"issues":[]}' }],
        },
        usage: { inputTokens: 1, outputTokens: 1 },
        finishReason: "stop",
        modelId: "critic",
      });
    },
    async *stream() {
      yield {
        type: "done" as const,
        response: {
          message: { role: "assistant" as const, parts: [] },
          usage: { inputTokens: 0, outputTokens: 0 },
          finishReason: "stop" as const,
          modelId: "critic",
        },
      };
    },
  };
  const queries = {
    query() {
      order.push("screenshot");
      return ok({
        imageRef: {
          hash: "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          size: 1,
          mime: "image/jpeg",
        },
        camera: { position: [0, 0, 0], target: [0, 0, 0] },
      });
    },
  };
  const verified = await createSceneVerifier().verify({
    policy: policyVision,
    mutated: true,
    queries: queries as unknown as QueryRegistry,
    tx: dummyTx,
    changedEntities: [],
    reader,
    llm,
    critic: { profile: profileVision },
    prompt: "look",
  });
  expect(verified.ok).toBe(true);
  expect(order[0]).toBe("spatial");
  expect(order.includes("vision")).toBe(true);
  expect(order.indexOf("spatial")).toBeLessThan(order.indexOf("vision"));
});

test("no vision downgrades to spatial", async () => {
  const verified = await createSceneVerifier().verify({
    policy: policyVision,
    mutated: true,
    queries: {} as QueryRegistry,
    tx: dummyTx,
    changedEntities: [],
    reader: emptyReader(),
    critic: { profile: { ...profileVision, vision: false } },
  });
  expect(verified.ok).toBe(true);
  if (!verified.ok) {
    return;
  }
  expect(verified.value.spatial !== null).toBe(true);
  expect(verified.value.vision).toBeNull();
});

test("repair round Verification feedback prefix", () => {
  const text = verificationFeedbackMessage(
    {
      issues: [
        { entity: "e_0000000000", path: "/a", check: "overlap", severity: "error", message: "x" },
      ],
    },
    null,
  );
  expect(text.startsWith("Verification feedback:")).toBe(true);
});
