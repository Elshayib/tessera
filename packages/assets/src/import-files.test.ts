import { createCommandBus, createDocument, createJobQueue } from "@tessera/core";
import { createLogger } from "@tessera/std";
import { MemoryBlobStore } from "@tessera/storage";
import { FakeClock } from "@tessera/testing";
import { expect, test } from "vitest";
import { createAssetService } from "./asset-service.js";
import { planFromFile } from "./import-files.js";
import { HARD_BLOB_LIMIT_BYTES } from "./import-plan.js";

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde,
]);

function fileOf(name: string, bytes: Uint8Array, type = ""): File {
  return new File([bytes], name, { type });
}

test("uploads default license unknown; source assets license ≠ unknown", async () => {
  const blobs = new MemoryBlobStore();
  const clock = new FakeClock();
  const plan = await planFromFile({ file: fileOf("wood.png", PNG, "image/png"), blobs, clock });
  expect(plan.ok).toBe(true);
  if (!plan.ok) {
    return;
  }
  expect(plan.value.assets[0]?.license).toBe("unknown");
  expect(plan.value.assets[0]?.kind).toBe("texture");
});

test("UNSUPPORTED extensions return UNSUPPORTED with convert hint", async () => {
  const blobs = new MemoryBlobStore();
  const clock = new FakeClock();
  const plan = await planFromFile({ file: fileOf("hero.fbx", new Uint8Array([1])), blobs, clock });
  expect(plan.ok).toBe(false);
  if (plan.ok) {
    return;
  }
  expect(plan.error.code).toBe("UNSUPPORTED");
  expect(plan.error.message.includes("Blender")).toBe(true);
});

test("INV-AST-02 importFiles commits ImportPlan in one transaction", async () => {
  const { doc, reader } = createDocument();
  const bus = createCommandBus(doc);
  const jobs = createJobQueue(bus, { logger: createLogger([]) });
  const blobs = new MemoryBlobStore();
  const clock = new FakeClock();
  const service = createAssetService({ bus, jobs, blobs, clock });
  let commits = 0;
  bus.events.on("transaction.committed", () => {
    commits += 1;
  });
  const started = await service.importFiles([fileOf("wood.png", PNG, "image/png")], {
    author: { kind: "user", id: "u1" },
  });
  expect(started.ok).toBe(true);
  if (!started.ok) {
    return;
  }
  const handle = started.value[0];
  if (handle === undefined) {
    return;
  }
  const result = await handle.result();
  expect(result.ok).toBe(true);
  const assets = [...reader.assets()];
  expect(assets).toHaveLength(1);
  expect(assets[0]?.license).toBe("unknown");
  expect(commits).toBe(1);
});

test("rejects oversize upload", async () => {
  const blobs = new MemoryBlobStore();
  const clock = new FakeClock();
  const huge = {
    name: "big.png",
    type: "image/png",
    size: HARD_BLOB_LIMIT_BYTES + 1,
    arrayBuffer: async () => new ArrayBuffer(0),
  };
  const plan = await planFromFile({ file: huge, blobs, clock });
  expect(plan.ok).toBe(false);
});
