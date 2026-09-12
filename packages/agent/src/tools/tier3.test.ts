import { createAssetService } from "@tessera/assets";
import { createCommandBus, createDocument, createJobQueue } from "@tessera/core";
import { createLogger, ok } from "@tessera/std";
import { FakeClock, FakeGenerationProvider, MemoryBlobStore } from "@tessera/testing";
import { expect, test } from "vitest";
import triangleGltf from "../../../schema/fixtures/gltf/triangle.json" with { type: "json" };
import { createToolRegistry } from "./registry.js";
import { createTier3Tools } from "./tier3.js";
import type { ToolContext } from "./types.js";

const BYTES = new TextEncoder().encode(JSON.stringify(triangleGltf));

function ctx(jobs: ReturnType<typeof createJobQueue>): ToolContext {
  return {
    runId: "r_testrun001",
    stepIndex: 0,
    author: { kind: "agent", id: "a1" },
    tx: { id: "t_aaaaaaaaaa", run: () => ok({}) },
    queries: {
      get() {
        return undefined;
      },
      has() {
        return false;
      },
      list() {
        return [];
      },
      register() {},
    },
    jobs,
    blobs: { has: () => true },
    policy: {
      enabledTiers: [0, 1, 2, 3],
      maxSteps: 8,
      maxToolCallsPerStep: 8,
      maxInputTokens: 1000,
      timeoutMs: 10_000,
      verify: "none",
      maxRepairRounds: 0,
      confirmDestructive: false,
      temperature: 0,
    },
    signal: new AbortController().signal,
    logger: createLogger([]),
  };
}

test("tier-3 tools exist and return jobId + etaSeconds", async () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const jobs = createJobQueue(bus, { logger: createLogger([]) });
  const blobs = new MemoryBlobStore();
  const assets = createAssetService({
    bus,
    jobs,
    blobs,
    clock: new FakeClock(),
    providers: { fake: new FakeGenerationProvider({ resultBytes: BYTES }) },
    delay: async () => undefined,
  });
  const registry = createToolRegistry();
  for (const tool of createTier3Tools(assets)) {
    registry.register(tool);
  }
  expect(registry.get("asset.search")).toBeDefined();
  expect(registry.get("asset.add")).toBeDefined();
  expect(registry.get("asset.generateMesh")).toBeDefined();
  expect(registry.get("asset.generateTexture")).toBeDefined();
  expect(registry.get("asset.generateEnvironment")).toBeDefined();
  expect(registry.get("asset.import")).toBeDefined();
  expect(registry.get("jobs.await")).toBeDefined();
  const generate = registry.get("asset.generateMesh");
  expect(generate !== undefined).toBe(true);
  if (generate === undefined) {
    return;
  }
  const result = await generate.execute(
    { providerId: "fake", prompt: "low-poly barrel", style: "lowpoly" },
    ctx(jobs),
  );
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  const record: Record<string, unknown> = { ...result.value };
  const jobKey = "jobId";
  const etaKey = "etaSeconds";
  expect(typeof record[jobKey]).toBe("string");
  expect(typeof record[etaKey]).toBe("number");
});

test("asset.import wraps AssetService.importFiles and returns a job handle", async () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const jobs = createJobQueue(bus, { logger: createLogger([]) });
  const blobs = new MemoryBlobStore();
  const assets = createAssetService({
    bus,
    jobs,
    blobs,
    clock: new FakeClock(),
  });
  const importTool = createTier3Tools(assets).find((tool) => tool.name === "asset.import");
  expect(importTool !== undefined).toBe(true);
  if (importTool === undefined) {
    return;
  }
  const png = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde,
  ]);
  const result = await importTool.execute(
    { blob: { fileName: "wood.png", bytesBase64: bytesToBase64(png), mime: "image/png" } },
    ctx(jobs),
  );
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  const record: Record<string, unknown> = { ...result.value };
  const jobKey = "jobId";
  const etaKey = "etaSeconds";
  expect(typeof record[jobKey]).toBe("string");
  expect(typeof record[etaKey]).toBe("number");
  const status = jobs.get(String(record[jobKey]));
  expect(status !== undefined).toBe(true);
});

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

test("jobs.await honors 120000 ms cap", async () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const jobs = createJobQueue(bus, { logger: createLogger([]) });
  const assets = createAssetService({ bus });
  const awaitTool = createTier3Tools(assets).find((tool) => tool.name === "jobs.await");
  expect(awaitTool !== undefined).toBe(true);
  if (awaitTool === undefined) {
    return;
  }
  const denied = await awaitTool.execute({ jobId: "j_aaaaaaaaaa", timeoutMs: 120_001 }, ctx(jobs));
  expect(denied.ok).toBe(false);
  if (denied.ok) {
    return;
  }
  expect(denied.error.code).toBe("INVALID_INPUT");
});
