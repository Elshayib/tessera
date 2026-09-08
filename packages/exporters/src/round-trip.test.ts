import { Logger, WebIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { commitPlan, importGltf } from "@tessera/assets";
import { createCommandBus, createDocument } from "@tessera/core";
import type { Document, Entity } from "@tessera/schema";
import { ColliderSchema, SidecarSchema } from "@tessera/schema";
import { isOk } from "@tessera/std";
import { MemoryBlobStore } from "@tessera/storage";
import { docBuilder, FakeClock } from "@tessera/testing";
import { expect, test } from "vitest";
import triangleGltf from "../../schema/fixtures/gltf/triangle.json" with { type: "json" };
import { createGltfExporter } from "./gltf.js";
import { GltfExportOptionsSchema } from "./options.js";

const author = { kind: "user" as const, id: "tester" };
const exporter = createGltfExporter();

function options() {
  return GltfExportOptionsSchema.parse({
    outputName: "round",
    deterministic: true,
    compression: "none",
  });
}

function primitiveDoc(): Document {
  const built = docBuilder()
    .geometry("box")
    .material("mat", { baseColor: "#8b5a2b" })
    .entity("Box", {
      mesh: "box",
      material: "mat",
      transform: { position: [1, 2, 3], rotation: [10, 20, 30] },
    })
    .build();
  const entity = Object.values(built.entities)[0];
  if (entity === undefined) {
    return built;
  }
  const tagged: Entity = {
    ...entity,
    components: {
      ...entity.components,
      tags: ["static"],
      collider: ColliderSchema.parse({ shape: "box", fit: "manual", size: [1, 2, 3] }),
    },
  };
  return { ...built, entities: { ...built.entities, [entity.id]: tagged } };
}

test("INV-ARCH-07 / INV-EXP-04 round-trip primitives", async () => {
  const original = primitiveDoc();
  const blobs = new MemoryBlobStore();
  const exported = await exporter.export({ document: original, blobs, options: options() });
  expect(isOk(exported)).toBe(true);
  if (!exported.ok) {
    return;
  }
  const glb = exported.value.files.find((file) => file.path.endsWith(".glb"));
  const sidecarFile = exported.value.files.find((file) => file.path.endsWith(".tessera.json"));
  expect(glb).toBeDefined();
  expect(sidecarFile).toBeDefined();
  if (glb === undefined || sidecarFile === undefined) {
    return;
  }
  const parsedSidecar: unknown = JSON.parse(await sidecarFile.blob.text());
  const sidecar = SidecarSchema.parse(parsedSidecar);
  const originalEntity = Object.values(original.entities)[0];
  expect(sidecar.entities[0]?.id).toBe(originalEntity?.id);
  expect(sidecar.entities[0]?.name).toBe("Box");
  expect(sidecar.entities[0]?.tags).toEqual(["static"]);

  const bytes = new Uint8Array(await glb.blob.arrayBuffer());
  const parsed = await new WebIO()
    .registerExtensions(ALL_EXTENSIONS)
    .setLogger(new Logger(Logger.Verbosity.SILENT))
    .readBinary(bytes);
  const extras = parsed.getRoot().listNodes()[0]?.getExtras() ?? {};
  const tessera = "tessera" in extras ? extras.tessera : undefined;
  if (typeof tessera === "object" && tessera !== null && !Array.isArray(tessera)) {
    const record: Record<string, unknown> = tessera;
    expect(record.id).toBe(originalEntity?.id);
  }

  const importBlobs = new MemoryBlobStore();
  const imported = await importGltf({
    bytes,
    fileName: "round.glb",
    blobs: importBlobs,
    clock: new FakeClock(),
  });
  expect(isOk(imported)).toBe(true);
  if (!imported.ok) {
    return;
  }
  const { doc, reader } = createDocument({ clock: new FakeClock() });
  const hashes = new Set(imported.value.blobs.map((blob) => blob.hash));
  const bus = createCommandBus(doc, { blobs: { has: (hash) => hashes.has(hash) } });
  const committed = commitPlan(bus, imported.value, { author });
  expect(isOk(committed)).toBe(true);
  const snapshot = reader.snapshot();
  const box = Object.values(snapshot.entities).find((entity) => entity.name === "Box");
  expect(box).toBeDefined();
  const position = box?.components.transform.position;
  expect(position?.[0]).toBeCloseTo(1, 4);
  expect(position?.[1]).toBeCloseTo(2, 4);
  expect(position?.[2]).toBeCloseTo(3, 4);
  expect(box?.components.transform.rotation[0]).toBeCloseTo(10, 4);
  expect(box?.components.transform.rotation[1]).toBeCloseTo(20, 4);
  expect(box?.components.transform.rotation[2]).toBeCloseTo(30, 4);
});

test("INV-AST-05 import then export fixture glTF", async () => {
  const blobs = new MemoryBlobStore();
  const imported = await importGltf({
    bytes: encodeGltf(triangleGltf),
    fileName: "triangle.gltf",
    blobs,
    clock: new FakeClock(),
  });
  expect(isOk(imported)).toBe(true);
  if (!imported.ok) {
    return;
  }
  const geometry = imported.value.assets.find((asset) => asset.kind === "geometry");
  expect(geometry?.kind === "geometry").toBe(true);
  const { doc, reader } = createDocument({ clock: new FakeClock() });
  const hashes = new Set(imported.value.blobs.map((blob) => blob.hash));
  const bus = createCommandBus(doc, { blobs: { has: (hash) => hashes.has(hash) } });
  const committed = commitPlan(bus, imported.value, { author });
  expect(isOk(committed)).toBe(true);
  if (!committed.ok) {
    return;
  }
  const snapshot = reader.snapshot();
  const exported = await exporter.export({ document: snapshot, blobs, options: options() });
  expect(isOk(exported)).toBe(true);
  if (!exported.ok) {
    return;
  }
  const glb = exported.value.files.find((file) => file.path.endsWith(".glb"));
  if (glb === undefined) {
    return;
  }
  const parsed = await new WebIO()
    .registerExtensions(ALL_EXTENSIONS)
    .setLogger(new Logger(Logger.Verbosity.SILENT))
    .readBinary(new Uint8Array(await glb.blob.arrayBuffer()));
  const mesh = parsed.getRoot().listMeshes()[0];
  const prim = mesh?.listPrimitives()[0];
  const positions = prim?.getAttribute("POSITION");
  const indices = prim?.getIndices();
  if (geometry?.kind === "geometry") {
    expect(positions?.getCount()).toBe(geometry.stats.vertices);
    expect((indices?.getCount() ?? 0) / 3).toBe(geometry.stats.triangles);
  }
  expect(parsed.getRoot().listMaterials().length).toBeGreaterThan(0);
});

function encodeGltf(json: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(json));
}
