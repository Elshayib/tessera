import { createAssetService } from "@tessera/assets";
import { createCommandBus, createDocument, createJobQueue, createQueryHost } from "@tessera/core";
import type { ModelRef } from "@tessera/llm";
import { FakeClock, MemoryBlobStore } from "@tessera/testing";
import { expect, test } from "vitest";
import type { CapabilityProfile } from "../types.js";
import { createToolRegistry } from "./registry.js";
import { selectTools } from "./select.js";
import { createTier3Tools } from "./tier3.js";
import type { RunPolicy } from "./types.js";

const REF: ModelRef = { providerId: "openai", modelId: "gpt-test" };

function profile(maxTools: number): CapabilityProfile {
  return {
    ref: REF,
    tools: "native",
    parallelTools: true,
    vision: false,
    structuredOutput: true,
    streaming: true,
    contextTokens: 32_000,
    maxTools,
    needsExamples: false,
    maxOutputTokens: 4_000,
  };
}

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

test("selectTools catalog mode when maxTools < 40", () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const host = createQueryHost(doc, { history: () => [] });
  const registry = createToolRegistry();
  registry.deriveFromRegistries(bus.registry, host.registry);
  const selected = selectTools(registry, policy(), profile(39));
  const names = new Set(selected.map((tool) => tool.name));
  expect(names.has("entity.get")).toBe(true);
  expect(names.has("scene.describe")).toBe(true);
  expect(names.has("plan.set")).toBe(true);
  expect(names.has("tools.catalog")).toBe(true);
  expect(names.has("tools.enable")).toBe(true);
  expect(names.has("ask_user")).toBe(true);
  expect(names.has("entity.create")).toBe(true);
  expect(names.has("component.set")).toBe(true);
  expect(names.has("asset.create")).toBe(false);
  expect(names.has("camera.setMain")).toBe(false);
  expect(names.has("environment.set")).toBe(false);
});

test("selectTools includes all enabled 0-2 when maxTools >= 40", () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const host = createQueryHost(doc, { history: () => [] });
  const registry = createToolRegistry();
  registry.deriveFromRegistries(bus.registry, host.registry);
  const selected = selectTools(registry, policy(), profile(40));
  const names = new Set(selected.map((tool) => tool.name));
  expect(names.has("asset.create")).toBe(true);
  expect(names.has("camera.setMain")).toBe(true);
  expect(names.has("environment.set")).toBe(true);
  expect(names.has("asset.import")).toBe(false);
});

test("selectTools exposes tier-3 asset/generate/jobs tools when enabledTiers includes 3", () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const host = createQueryHost(doc, { history: () => [] });
  const jobs = createJobQueue(bus, { logger: doc.logger });
  const registry = createToolRegistry();
  registry.deriveFromRegistries(bus.registry, host.registry);
  const assets = createAssetService({
    bus,
    jobs,
    blobs: new MemoryBlobStore(),
    clock: new FakeClock(),
  });
  for (const tool of createTier3Tools(assets)) {
    registry.register(tool);
  }
  const withTier3: RunPolicy = { ...policy(), enabledTiers: [0, 1, 2, 3] };
  const selected = selectTools(registry, withTier3, profile(40));
  const names = new Set(selected.map((tool) => tool.name));
  expect(names.has("asset.search")).toBe(true);
  expect(names.has("asset.add")).toBe(true);
  expect(names.has("asset.generateMesh")).toBe(true);
  expect(names.has("asset.generateTexture")).toBe(true);
  expect(names.has("asset.generateEnvironment")).toBe(true);
  expect(names.has("asset.import")).toBe(true);
  expect(names.has("jobs.await")).toBe(true);
  const omitted = selectTools(registry, policy(), profile(40));
  expect(omitted.some((tool) => tool.name === "asset.search")).toBe(false);
});
