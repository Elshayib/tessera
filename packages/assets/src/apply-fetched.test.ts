import { createCommandBus, createDocument, createJobQueue } from "@tessera/core";
import { createLogger } from "@tessera/std";
import { MemoryBlobStore } from "@tessera/storage";
import { FakeAssetSource, FakeClock } from "@tessera/testing";
import { expect, test } from "vitest";
import { createAssetService } from "./asset-service.js";

const ITEM = {
  id: "bark",
  name: "Bark",
  kind: "texture" as const,
  thumbnailUrl: "https://example.invalid/b.png",
  tags: [],
  license: "CC0-1.0",
  author: "Poly",
};

test("INV-AST-04 polyhaven addFromSource sets license and provenance", async () => {
  const { doc, reader } = createDocument();
  const bus = createCommandBus(doc);
  const jobs = createJobQueue(bus, { logger: createLogger([]) });
  const blobs = new MemoryBlobStore();
  const clock = new FakeClock();
  const source = new FakeAssetSource({ items: [ITEM], clock, license: "CC0-1.0" });
  const service = createAssetService({ bus, jobs, blobs, clock, sources: [source], reader });
  const handle = await service.addFromSource("fake-source", ITEM, {
    author: { kind: "user", id: "u1" },
  });
  expect(handle.ok).toBe(true);
  if (!handle.ok) {
    return;
  }
  const done = await handle.value.result();
  expect(done.ok).toBe(true);
  const assets = [...reader.assets()];
  expect(assets.length).toBeGreaterThan(0);
  expect(assets.every((asset) => asset.license !== "unknown")).toBe(true);
  expect(assets.every((asset) => asset.provenance.source === "fake-source")).toBe(true);
  expect(assets.every((asset) => asset.provenance.sourceId === "bark")).toBe(true);
});

test("texture apply creates texture asset and is not a no-op", async () => {
  const { doc, reader } = createDocument();
  const bus = createCommandBus(doc);
  const jobs = createJobQueue(bus, { logger: createLogger([]) });
  const blobs = new MemoryBlobStore();
  const clock = new FakeClock();
  const source = new FakeAssetSource({ items: [ITEM], clock });
  const service = createAssetService({ bus, jobs, blobs, clock, sources: [source], reader });
  const before = [...reader.assets()].length;
  const handle = await service.addFromSource("fake-source", ITEM, {
    author: { kind: "user", id: "u1" },
  });
  expect(handle.ok).toBe(true);
  if (!handle.ok) {
    return;
  }
  await handle.value.result();
  const kinds = [...reader.assets()].map((asset) => asset.kind);
  expect(kinds).toContain("texture");
  expect(kinds).toContain("material");
  expect([...reader.assets()].length).toBeGreaterThan(before);
});
