import type { FetchedAsset, SearchItem } from "@tessera/assets";
import { createAssetService } from "@tessera/assets";
import { createCommandBus, createDocument, fromYDoc } from "@tessera/core";
import { type BlobRef, emptyDocument, validateDocument } from "@tessera/schema";
import { isOk, systemClock } from "@tessera/std";
import { MemoryBlobStore } from "@tessera/storage";
import { expect, test } from "vitest";
import { applyFetchedModel, applyHdri } from "./apply-source.js";

const author = { kind: "user" as const, id: "tester" };

const TRIANGLE_GLTF = {
  asset: { version: "2.0", generator: "tessera-fixture" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: "Triangle", mesh: 0 }],
  meshes: [
    {
      name: "Triangle",
      primitives: [{ attributes: { POSITION: 1 }, indices: 0, material: 0 }],
    },
  ],
  materials: [
    {
      name: "Red",
      pbrMetallicRoughness: {
        baseColorFactor: [1, 0, 0, 1],
        metallicFactor: 0,
        roughnessFactor: 0.6,
      },
    },
  ],
  accessors: [
    { bufferView: 0, componentType: 5123, count: 3, type: "SCALAR" },
    {
      bufferView: 1,
      componentType: 5126,
      count: 3,
      type: "VEC3",
      max: [1, 1, 0],
      min: [0, 0, 0],
    },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: 6, target: 34963 },
    { buffer: 0, byteOffset: 8, byteLength: 36, target: 34962 },
  ],
  buffers: [
    {
      uri: "data:application/octet-stream;base64,AAABAAIAAAAAAAAAAAAAAAAAAAAAAIA/AAAAAAAAAAAAAAAAAACAPwAAAAA=",
      byteLength: 44,
    },
  ],
};

const hdriItem: SearchItem = {
  id: "forest_slope",
  name: "Forest Slope",
  kind: "hdri",
  thumbnailUrl: "https://fixture.local/thumb.png",
  tags: ["outdoor"],
  license: "CC0-1.0",
  author: "Greg",
};

function fetched(blob: BlobRef): FetchedAsset {
  return {
    blobs: [blob],
    license: "CC0-1.0",
    provenance: {
      source: "polyhaven",
      sourceId: "forest_slope",
      sourceUrl: "https://polyhaven.com/a/forest_slope",
      importedAt: systemClock.nowIso(),
      author: "Greg",
    },
  };
}

test("apply HDRI uses asset.create and environment.set", async () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  const store = new MemoryBlobStore();
  const written = await store.write(new Uint8Array([1, 2, 3]), "image/vnd.radiance", "forest.hdr");
  expect(written.ok).toBe(true);
  if (!written.ok) {
    return;
  }
  const names: string[] = [];
  const stop = bus.events.on("transaction.committed", (payload) => {
    for (const command of payload.transaction.commands) {
      names.push(command.name);
    }
  });
  const applied = applyHdri(bus, fetched(written.value), hdriItem, author);
  stop();
  expect(isOk(applied)).toBe(true);
  expect(names.includes("asset.create")).toBe(true);
  expect(names.includes("environment.set")).toBe(true);
  expect(validateDocument(fromYDoc(doc.ydoc)).ok).toBe(true);
  if (!applied.ok) {
    return;
  }
  const sky = reader.snapshot().environment.sky;
  expect(sky.kind).toBe("environment");
  if (sky.kind !== "environment") {
    return;
  }
  expect(sky.asset).toBe(applied.value.assetId);
  expect(reader.getAsset(applied.value.assetId)?.kind).toBe("environment");
});

test("apply model uses importGltf then commitPlan", async () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  const assets = createAssetService({ bus });
  const store = new MemoryBlobStore();
  const bytes = new TextEncoder().encode(JSON.stringify(TRIANGLE_GLTF));
  const written = await store.write(bytes, "model/gltf+json", "triangle.gltf");
  expect(written.ok).toBe(true);
  if (!written.ok) {
    return;
  }
  const item: SearchItem = {
    id: "wooden_barrel",
    name: "Wooden Barrel",
    kind: "model",
    thumbnailUrl: "https://fixture.local/thumb.png",
    tags: ["prop"],
    license: "CC0-1.0",
  };
  const applied = await applyFetchedModel(
    assets,
    store,
    systemClock,
    fetched(written.value),
    item,
    author,
    new AbortController().signal,
  );
  expect(isOk(applied)).toBe(true);
  expect(validateDocument(fromYDoc(doc.ydoc)).ok).toBe(true);
  if (!applied.ok) {
    return;
  }
  expect(applied.value.entityIds.length).toBeGreaterThan(0);
  const entityId = applied.value.entityIds[0];
  expect(entityId !== undefined).toBe(true);
  if (entityId === undefined) {
    return;
  }
  expect(reader.getEntity(entityId)?.components.meshRenderer).toBeDefined();
});
