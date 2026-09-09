import { createCommandBus, createDocument, createQueryHost } from "@tessera/core";
import { createLogger, Emitter, ok } from "@tessera/std";
import { expect, test } from "vitest";
import type { CapabilityProfile } from "../types.js";
import { createToolRegistry } from "./registry.js";
import { selectTools } from "./select.js";
import type { RunPolicy, ToolContext } from "./types.js";

function policy(): RunPolicy {
  return {
    enabledTiers: [0, 1, 2],
    maxSteps: 24,
    maxToolCallsPerStep: 16,
    maxInputTokens: 400_000,
    timeoutMs: 600_000,
    verify: "spatial",
    maxRepairRounds: 2,
    confirmDestructive: false,
    temperature: 0.2,
  };
}

function fatProfile(): CapabilityProfile {
  return {
    ref: { providerId: "openai", modelId: "gpt-test" },
    tools: "native",
    parallelTools: true,
    vision: false,
    structuredOutput: true,
    streaming: true,
    contextTokens: 32_000,
    maxTools: 39,
    needsExamples: false,
    maxOutputTokens: 4_000,
  };
}

function ctx(
  registryQueries = createQueryHost(createDocument().doc, { history: () => [] }).registry,
): ToolContext {
  return {
    runId: "r_test000001",
    stepIndex: 0,
    author: { kind: "agent", id: "test", runId: "r_test000001" },
    tx: { id: "t_test000001", run: () => ok({}) },
    queries: registryQueries,
    jobs: {
      enqueue: () => ({
        id: "j_abcdefghij",
        result: () => Promise.resolve(ok(undefined)),
      }),
      get: () => undefined,
      list: () => [],
      cancel: () => undefined,
      events: new Emitter(),
    },
    blobs: { has: () => false },
    policy: policy(),
    signal: new AbortController().signal,
    logger: createLogger([]),
  };
}

test("meta plan.set tools.catalog tools.enable ask_user", async () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const host = createQueryHost(doc, { history: () => [] });
  const registry = createToolRegistry();
  registry.deriveFromRegistries(bus.registry, host.registry);
  const plan = registry.get("plan.set");
  const catalog = registry.get("tools.catalog");
  const enable = registry.get("tools.enable");
  const ask = registry.get("ask_user");
  expect(plan?.group).toBe("meta");
  expect(catalog?.group).toBe("meta");
  expect(enable?.group).toBe("meta");
  expect(ask?.group).toBe("meta");
  expect(plan?.tier).toBe(0);
  expect(catalog).toBeDefined();
  expect(enable).toBeDefined();
  expect(ask).toBeDefined();
  if (plan === undefined || catalog === undefined || enable === undefined || ask === undefined) {
    return;
  }
  const planned = await plan.execute(
    { items: [{ text: "read outline", done: false }] },
    ctx(host.registry),
  );
  expect(planned.ok).toBe(true);
  const listed = await catalog.execute({}, ctx(host.registry));
  expect(listed.ok).toBe(true);
  if (listed.ok) {
    const payload = listed.value;
    expect(payload).toBeTypeOf("object");
  }
  const before = new Set(selectTools(registry, policy(), fatProfile()).map((tool) => tool.name));
  expect(before.has("asset.create")).toBe(false);
  const enabled = await enable.execute({ group: "assets" }, ctx(host.registry));
  expect(enabled.ok).toBe(true);
  const after = new Set(selectTools(registry, policy(), fatProfile()).map((tool) => tool.name));
  expect(after.has("asset.create")).toBe(true);
  const asked = await ask.execute({ question: "Delete the forest?" }, ctx(host.registry));
  expect(asked.ok).toBe(true);
});
