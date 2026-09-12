import { createCommandBus, createDocument, createJobQueue } from "@tessera/core";
import { createLogger } from "@tessera/std";
import { MemoryBlobStore } from "@tessera/storage";
import { FakeAssetSource, FakeClock } from "@tessera/testing";
import { expect, test } from "vitest";
import { createAssetService } from "./asset-service.js";

const MODEL = {
  id: "barrel",
  name: "Barrel",
  kind: "model" as const,
  thumbnailUrl: "https://example.invalid/b.png",
  tags: [],
  license: "CC0-1.0",
};

test("INV-AST-02 addFromSource commits through command bus once", async () => {
  const { doc, reader } = createDocument();
  const bus = createCommandBus(doc);
  const jobs = createJobQueue(bus, { logger: createLogger([]) });
  const blobs = new MemoryBlobStore();
  const clock = new FakeClock();
  const source = new FakeAssetSource({
    items: [
      {
        ...MODEL,
        kind: "hdri",
        id: "forest",
        name: "Forest",
      },
    ],
    clock,
  });
  const service = createAssetService({ bus, jobs, blobs, clock, sources: [source], reader });
  let commits = 0;
  bus.events.on("transaction.committed", () => {
    commits += 1;
  });
  const handle = await service.addFromSource(
    "fake-source",
    { ...MODEL, kind: "hdri", id: "forest", name: "Forest" },
    { author: { kind: "user", id: "u1" }, setSky: true },
  );
  expect(handle.ok).toBe(true);
  if (!handle.ok) {
    return;
  }
  const done = await handle.value.result();
  expect(done.ok).toBe(true);
  expect(commits).toBe(1);
  expect(reader.snapshot().environment.sky.kind).toBe("environment");
});

test("search missing source → NOT_FOUND", async () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const service = createAssetService({ bus });
  const result = await service.search("missing", { text: "", kind: "hdri" });
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.error.code).toBe("NOT_FOUND");
});
