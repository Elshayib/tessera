import { createCommandBus, createDocument, createJobQueue } from "@tessera/core";
import { createLogger } from "@tessera/std";
import { MemoryBlobStore } from "@tessera/storage";
import { FakeClock, FakeGenerationProvider } from "@tessera/testing";
import { expect, test } from "vitest";
import triangleGltf from "../../schema/fixtures/gltf/triangle.json" with { type: "json" };
import { createAssetService } from "./asset-service.js";

const BYTES = new TextEncoder().encode(JSON.stringify(triangleGltf));

test("INV-PRV-05 generate → import pipeline → commit fills generator and license", async () => {
  const { doc, reader } = createDocument();
  const bus = createCommandBus(doc);
  const jobs = createJobQueue(bus, { logger: createLogger([]) });
  const blobs = new MemoryBlobStore();
  const clock = new FakeClock();
  const provider = new FakeGenerationProvider({
    resultBytes: BYTES,
    pollStates: ["succeeded"],
  });
  const service = createAssetService({
    bus,
    jobs,
    blobs,
    clock,
    reader,
    providers: { fake: provider },
    delay: async () => undefined,
  });
  const handle = await service.generate(
    "fake",
    { kind: "mesh", pbr: true, prompt: "low-poly barrel", style: "lowpoly" },
    { author: { kind: "user", id: "u1" } },
  );
  expect(handle.ok).toBe(true);
  if (!handle.ok) {
    return;
  }
  const done = await handle.value.result();
  expect(done.ok).toBe(true);
  const assets = [...reader.assets()];
  expect(assets.length).toBeGreaterThan(0);
  expect(assets.every((asset) => asset.license !== "unknown")).toBe(true);
  expect(assets.some((asset) => asset.provenance.generator !== undefined)).toBe(true);
  expect(assets.some((asset) => asset.provenance.source === "generated")).toBe(true);
});

test("enqueue import/generate JobSpec emits job.updated progress", async () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const jobs = createJobQueue(bus, { logger: createLogger([]) });
  const blobs = new MemoryBlobStore();
  const clock = new FakeClock();
  const provider = new FakeGenerationProvider({ resultBytes: BYTES });
  const service = createAssetService({
    bus,
    jobs,
    blobs,
    clock,
    providers: { fake: provider },
    delay: async () => undefined,
  });
  const updates: number[] = [];
  jobs.events.on("job.updated", (event) => {
    updates.push(event.status.progress);
  });
  const handle = await service.generate(
    "fake",
    { kind: "mesh", pbr: true, prompt: "barrel" },
    { author: { kind: "user", id: "u1" } },
  );
  expect(handle.ok).toBe(true);
  if (!handle.ok) {
    return;
  }
  await handle.value.result();
  expect(updates.length).toBeGreaterThan(0);
});

test("generate texture and environment plans skip glTF import", async () => {
  const { doc, reader } = createDocument();
  const bus = createCommandBus(doc);
  const jobs = createJobQueue(bus, { logger: createLogger([]) });
  const blobs = new MemoryBlobStore();
  const clock = new FakeClock();
  const provider = new FakeGenerationProvider({ resultBytes: new Uint8Array([1, 2, 3, 4]) });
  const service = createAssetService({
    bus,
    jobs,
    blobs,
    clock,
    reader,
    providers: { fake: provider },
    delay: async () => undefined,
  });
  const tex = await service.generate(
    "fake",
    { kind: "texture", prompt: "wood", resolution: 1024, maps: ["baseColor"] },
    { author: { kind: "user", id: "u1" } },
  );
  expect(tex.ok).toBe(true);
  if (tex.ok) {
    expect((await tex.value.result()).ok).toBe(true);
  }
  const env = await service.generate(
    "fake",
    { kind: "environment", prompt: "forest", resolution: 2048 },
    { author: { kind: "user", id: "u1" } },
  );
  expect(env.ok).toBe(true);
  if (env.ok) {
    expect((await env.value.result()).ok).toBe(true);
  }
});

test("generate missing provider is NOT_FOUND", async () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const jobs = createJobQueue(bus, { logger: createLogger([]) });
  const service = createAssetService({
    bus,
    jobs,
    blobs: new MemoryBlobStore(),
    clock: new FakeClock(),
  });
  const result = await service.generate("missing", { kind: "mesh", pbr: true, prompt: "x" });
  expect(result.ok).toBe(false);
});

test("cancel in-flight job", async () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const jobs = createJobQueue(bus, { logger: createLogger([]) });
  const blobs = new MemoryBlobStore();
  const clock = new FakeClock();
  let release: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const provider = new FakeGenerationProvider({
    resultBytes: BYTES,
    pollStates: ["queued", "queued", "succeeded"],
  });
  const service = createAssetService({
    bus,
    jobs,
    blobs,
    clock,
    providers: { fake: provider },
    delay: async () => blocked,
  });
  const handle = await service.generate(
    "fake",
    { kind: "mesh", pbr: true, prompt: "barrel" },
    { author: { kind: "user", id: "u1" } },
  );
  expect(handle.ok).toBe(true);
  if (!handle.ok) {
    return;
  }
  jobs.cancel(handle.value.id);
  release?.();
  const done = await handle.value.result();
  expect(done.ok).toBe(false);
  if (done.ok) {
    return;
  }
  expect(done.error.code).toBe("CANCELLED");
});
